const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../db/supabase');

// POST /api/auth/register
router.post('/register', async (req, res) => {
  const { name, email, password } = req.body;

  if (!email || !password || !name) {
    return res.status(400).json({ error: 'Name, E-Mail und Passwort sind erforderlich' });
  }

  try {
    // Create user with Supabase Auth
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name }
    });

    if (error) {
      if (error.message.includes('already')) {
        return res.status(409).json({ error: 'Diese E-Mail ist bereits registriert' });
      }
      // If trigger-related DB error, log details for debugging
      console.error('Supabase createUser error:', error.message);
      return res.status(400).json({ error: error.message });
    }

    // Manually create profile (no dependency on database triggers)
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .upsert({
        id: data.user.id,
        name,
        email,
        plan: 'free',
        tokens_used: 0,
        tokens_limit: 500000
      }, { onConflict: 'id' });

    if (profileError) {
      console.error('Profile creation error:', profileError);
      // User exists in auth but profile failed — don't block registration
    }

    // Sign in immediately to get session tokens
    const { data: signInData, error: signInError } = await supabaseAdmin.auth.signInWithPassword({
      email,
      password
    });

    if (signInError) {
      return res.status(500).json({ error: 'Account erstellt, aber Anmeldung fehlgeschlagen' });
    }

    res.json({
      success: true,
      user: {
        id: data.user.id,
        name,
        email
      },
      session: {
        access_token: signInData.session.access_token,
        refresh_token: signInData.session.refresh_token
      }
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Registrierung fehlgeschlagen' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'E-Mail und Passwort sind erforderlich' });
  }

  try {
    const { data, error } = await supabaseAdmin.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      return res.status(401).json({ error: 'E-Mail oder Passwort ist falsch' });
    }

    // Get profile
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', data.user.id)
      .single();

    res.json({
      success: true,
      user: {
        id: data.user.id,
        name: profile?.name || '',
        email: data.user.email,
        plan: profile?.plan || 'free',
        tokens_used: profile?.tokens_used || 0,
        tokens_limit: profile?.tokens_limit || 500000
      },
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Anmeldung fehlgeschlagen' });
  }
});

// POST /api/auth/refresh
router.post('/refresh', async (req, res) => {
  const { refresh_token } = req.body;

  if (!refresh_token) {
    return res.status(400).json({ error: 'Refresh token fehlt' });
  }

  try {
    const { data, error } = await supabaseAdmin.auth.refreshSession({
      refresh_token
    });

    if (error) {
      return res.status(401).json({ error: 'Session abgelaufen, bitte erneut anmelden' });
    }

    res.json({
      success: true,
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Token-Erneuerung fehlgeschlagen' });
  }
});

// GET /api/auth/me — get current user profile
router.get('/me', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Nicht authentifiziert' });
  }

  try {
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (error || !user) {
      return res.status(401).json({ error: 'Ungültiges Token' });
    }

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    res.json({
      id: user.id,
      name: profile?.name || '',
      email: user.email,
      plan: profile?.plan || 'free',
      tokens_used: profile?.tokens_used || 0,
      tokens_limit: profile?.tokens_limit || 500000
    });
  } catch (err) {
    res.status(500).json({ error: 'Profil konnte nicht geladen werden' });
  }
});

// POST /api/auth/forgot-password — send reset email
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'E-Mail ist erforderlich' });

  try {
    const redirectTo = `${req.protocol}://${req.get('host')}/auth.html?mode=reset`;
    const { error } = await supabaseAdmin.auth.resetPasswordForEmail(email, { redirectTo });

    // Always return success to prevent email enumeration
    res.json({ success: true, message: 'Falls ein Konto mit dieser E-Mail existiert, wurde eine E-Mail zum Zurücksetzen gesendet.' });
  } catch (err) {
    console.error('Forgot password error:', err);
    res.json({ success: true, message: 'Falls ein Konto mit dieser E-Mail existiert, wurde eine E-Mail zum Zurücksetzen gesendet.' });
  }
});

// POST /api/auth/reset-password — set new password with access token
router.post('/reset-password', async (req, res) => {
  const { access_token, password } = req.body;
  if (!access_token || !password) return res.status(400).json({ error: 'Token und neues Passwort sind erforderlich' });
  if (password.length < 6) return res.status(400).json({ error: 'Passwort muss mindestens 6 Zeichen lang sein' });

  try {
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(access_token);
    if (error || !user) return res.status(401).json({ error: 'Ungültiger oder abgelaufener Link' });

    const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(user.id, { password });
    if (updateErr) return res.status(500).json({ error: 'Passwort konnte nicht geändert werden' });

    res.json({ success: true, message: 'Passwort erfolgreich geändert. Du kannst dich jetzt anmelden.' });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ error: 'Passwort zurücksetzen fehlgeschlagen' });
  }
});

module.exports = router;
