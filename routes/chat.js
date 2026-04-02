const express = require('express');
const router = express.Router();
const Anthropic = require('@anthropic-ai/sdk');
const { supabaseAdmin } = require('../db/supabase');
const { requireAuth } = require('../middleware/auth');
const { getSystemPrompt, extractFiles, extractText, getPreviewHtml } = require('../prompts/system');

router.use(requireAuth);

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function formatTokenLimit(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(0) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(0) + 'K';
  return String(n);
}

const MODELS = {
  'sonnet': 'claude-sonnet-4-6',
  'opus': 'claude-sonnet-4-6',
  'haiku': 'claude-haiku-4-5-20251001',
};

// POST /api/chat/send — send message + stream Claude response (full-stack)
router.post('/send', async (req, res) => {
  const { projectId, message, model, skills } = req.body;

  if (!projectId || !message) {
    return res.status(400).json({ error: 'projectId und message sind erforderlich' });
  }

  // Check token limits before calling Claude — strictly per user
  let { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('plan, tokens_used, tokens_limit')
    .eq('id', req.userId)
    .single();

  // If no profile exists, create one now (safety net for users registered before fix)
  if (!profile) {
    const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(req.userId);
    const { data: newProfile, error: createErr } = await supabaseAdmin
      .from('profiles')
      .upsert({
        id: req.userId,
        name: authUser?.user?.user_metadata?.name || '',
        email: authUser?.user?.email || '',
        plan: 'explorer',
        tokens_used: 0,
        tokens_limit: 30000
      }, { onConflict: 'id' })
      .select('plan, tokens_used, tokens_limit')
      .single();

    if (createErr || !newProfile) {
      console.error('Failed to create profile for user:', req.userId, createErr);
      return res.status(500).json({ error: 'Benutzerprofil konnte nicht geladen werden.' });
    }
    profile = newProfile;
  }

  // Strict token check — no profile bypass possible
  if (profile.tokens_used >= profile.tokens_limit) {
    return res.status(429).json({
      error: `Token-Limit erreicht (${formatTokenLimit(profile.tokens_limit)}). Upgrade deinen Plan für mehr Tokens.`,
      tokens_used: profile.tokens_used,
      tokens_limit: profile.tokens_limit
    });
  }

  // Restrict Opus to pro/business plans
  const userPlan = profile.plan || 'explorer';
  let modelId = MODELS[model] || MODELS['haiku'];
  if (model === 'opus' && (userPlan === 'explorer' || userPlan === 'starter')) {
    modelId = MODELS['sonnet'];
  }
  // Explorer only gets Haiku
  if (userPlan === 'explorer') {
    modelId = MODELS['haiku'];
  }

  try {
    // 1. Get project with all files
    const { data: project, error: projErr } = await supabaseAdmin
      .from('projects')
      .select('id, current_html, project_files, user_id')
      .eq('id', projectId)
      .eq('user_id', req.userId)
      .single();

    if (projErr || !project) {
      return res.status(404).json({ error: 'Projekt nicht gefunden' });
    }

    // Current project files (JSON object: { "filename": "content" })
    const currentFiles = project.project_files || {};

    // 2. Get conversation history (last 20 messages)
    const { data: history } = await supabaseAdmin
      .from('messages')
      .select('role, content')
      .eq('project_id', projectId)
      .order('created_at', { ascending: true })
      .limit(20);

    const claudeMessages = (history || []).map(m => ({
      role: m.role,
      content: m.content
    }));

    claudeMessages.push({ role: 'user', content: message });

    // 3. Save user message
    await supabaseAdmin.from('messages').insert({
      project_id: projectId,
      role: 'user',
      content: message
    });

    // 4. SSE streaming setup
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    // 5. Call Claude with full-stack system prompt
    let fullResponse = '';
    let inputTokens = 0;
    let outputTokens = 0;

    const stream = await anthropic.messages.stream({
      model: modelId,
      max_tokens: 16000,
      system: getSystemPrompt(currentFiles, skills),
      messages: claudeMessages
    });

    stream.on('text', (text) => {
      fullResponse += text;
      res.write(`data: ${JSON.stringify({ type: 'text', content: text })}\n\n`);
    });

    stream.on('message', async (msg) => {
      inputTokens = msg.usage?.input_tokens || 0;
      outputTokens = msg.usage?.output_tokens || 0;

      // 6. Extract ALL files from response
      const newFiles = extractFiles(fullResponse);
      const text = extractText(fullResponse);
      const hasFiles = Object.keys(newFiles).length > 0;

      // 7. Merge new files into existing project files
      const mergedFiles = { ...currentFiles, ...newFiles };
      const previewHtml = getPreviewHtml(mergedFiles);

      // 8. Save assistant message
      await supabaseAdmin.from('messages').insert({
        project_id: projectId,
        role: 'assistant',
        content: fullResponse,
        tokens_used: inputTokens + outputTokens
      });

      // 9. Update project with all files
      if (hasFiles) {
        await supabaseAdmin
          .from('projects')
          .update({
            project_files: mergedFiles,
            current_html: previewHtml || project.current_html,
            updated_at: new Date().toISOString()
          })
          .eq('id', projectId);

        // Version snapshot
        const { count } = await supabaseAdmin
          .from('versions')
          .select('*', { count: 'exact', head: true })
          .eq('project_id', projectId);

        await supabaseAdmin.from('versions').insert({
          project_id: projectId,
          html: JSON.stringify(mergedFiles),
          label: `v${(count || 0) + 1}`
        });
      }

      // 10. Update token usage atomically per user
      const totalTokens = inputTokens + outputTokens;
      try {
        // Try atomic increment via RPC first (no race condition)
        const { error: rpcErr } = await supabaseAdmin.rpc('increment_tokens', {
          user_id: req.userId,
          amount: totalTokens
        });

        // Fallback: manual update if RPC function not yet deployed
        if (rpcErr) {
          const { data: freshProfile } = await supabaseAdmin
            .from('profiles')
            .select('tokens_used')
            .eq('id', req.userId)
            .single();

          if (freshProfile) {
            await supabaseAdmin
              .from('profiles')
              .update({ tokens_used: (freshProfile.tokens_used || 0) + totalTokens })
              .eq('id', req.userId);
          }
        }
      } catch (tokenErr) {
        console.error('Token update error for user:', req.userId, tokenErr);
      }

      // 11. Send final event with files + preview
      res.write(`data: ${JSON.stringify({
        type: 'done',
        files: hasFiles ? mergedFiles : null,
        fileList: hasFiles ? Object.keys(mergedFiles) : [],
        html: previewHtml || null,
        text,
        usage: { input: inputTokens, output: outputTokens, total: inputTokens + outputTokens }
      })}\n\n`);

      res.end();
    });

    stream.on('error', (error) => {
      console.error('Claude stream error:', {
        status: error.status,
        message: error.message,
        type: error.error?.type,
        detail: error.error?.message,
        model: modelId,
        userId: req.userId
      });
      const userMsg = error.status === 404
        ? 'Modell nicht verfügbar. Bitte versuche es erneut.'
        : error.status === 429
        ? 'API-Limit erreicht. Bitte warte einen Moment und versuche es erneut.'
        : error.status === 529
        ? 'KI-Server überlastet. Bitte versuche es in einer Minute erneut.'
        : `KI-Antwort fehlgeschlagen (${error.status || 'Netzwerk'}). Bitte versuche es erneut.`;
      res.write(`data: ${JSON.stringify({
        type: 'error',
        error: userMsg
      })}\n\n`);
      res.end();
    });

    req.on('close', () => { stream.abort?.(); });

  } catch (err) {
    console.error('Chat send error:', {
      status: err.status,
      message: err.message,
      type: err.error?.type,
      detail: err.error?.message,
      model: MODELS[model] || model,
      userId: req.userId
    });
    if (!res.headersSent) {
      res.status(500).json({ error: 'Nachricht konnte nicht gesendet werden: ' + (err.message || 'Unbekannter Fehler') });
    } else {
      res.write(`data: ${JSON.stringify({ type: 'error', error: 'KI-Antwort fehlgeschlagen. Bitte versuche es erneut.' })}\n\n`);
      res.end();
    }
  }
});

// POST /api/chat/upload — upload a file to include in chat context
const multer = require('multer');
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB max
  fileFilter: (req, file, cb) => {
    const allowed = ['.html', '.css', '.js', '.json', '.txt', '.md', '.sql', '.env', '.csv', '.xml', '.svg', '.ts', '.jsx', '.tsx', '.py'];
    const ext = '.' + file.originalname.split('.').pop().toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error('Nur Code- und Text-Dateien erlaubt'));
  }
});

router.post('/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Keine Datei hochgeladen' });

  const content = req.file.buffer.toString('utf-8');
  const name = req.file.originalname;

  res.json({
    success: true,
    file: { name, content, size: req.file.size }
  });
});

module.exports = router;
