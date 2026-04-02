const { supabaseAdmin } = require('../db/supabase');

// Middleware: validates Supabase access token from Authorization header
async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.warn(`🔒 Auth abgelehnt: Kein Bearer-Token — ${req.method} ${req.originalUrl}`);
    return res.status(401).json({ error: 'Nicht authentifiziert' });
  }

  const token = authHeader.replace('Bearer ', '');

  try {
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);

    if (error || !user) {
      console.warn(`🔒 Auth abgelehnt: Ungültiges Token — ${req.method} ${req.originalUrl} — ${error?.message || 'user null'}`);
      return res.status(401).json({ error: 'Ungültiges Token' });
    }

    // Attach user to request
    req.user = user;
    req.userId = user.id;
    next();
  } catch (err) {
    console.error(`🔒 Auth-Fehler: ${req.method} ${req.originalUrl} —`, err.message);
    return res.status(500).json({ error: 'Authentifizierung fehlgeschlagen' });
  }
}

module.exports = { requireAuth };
