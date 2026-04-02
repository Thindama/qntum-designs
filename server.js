require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');

const authRoutes = require('./routes/auth');
const projectRoutes = require('./routes/projects');
const chatRoutes = require('./routes/chat');
const publishRoutes = require('./routes/publish');
const stripeRoutes = require('./routes/stripe');
const webhookRoutes = require('./routes/webhook');
const componentRoutes = require('./routes/components');

const app = express();
const PORT = process.env.PORT || 3000;

// ── Stripe Webhook (must be before express.json) ──
app.use('/api/webhook', webhookRoutes);

// ── Middleware ─────────────────────────────────────
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? process.env.FRONTEND_URL
    : 'http://localhost:3000',
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));

// ── Custom Domain Middleware ──────────────────────
// If a request comes from a custom domain, serve the published site directly
app.use(async (req, res, next) => {
  const host = req.hostname;
  const appDomain = process.env.APP_DOMAIN || 'localhost';

  // Skip if request is to the main app domain or localhost
  if (host === appDomain || host === 'localhost' || host === '127.0.0.1' || host.endsWith('.railway.app')) {
    return next();
  }

  // Check if this host matches a custom domain
  try {
    const { supabaseAdmin } = require('./db/supabase');
    const { data: project } = await supabaseAdmin
      .from('projects')
      .select('current_html, project_files, slug')
      .eq('custom_domain', host)
      .eq('status', 'live')
      .maybeSingle();

    if (project) {
      const files = project.project_files || {};
      // Serve sub-files if path is not root
      if (req.path !== '/' && req.path !== '/index.html') {
        const filename = req.path.replace(/^\//, '');
        if (files[filename]) {
          const ext = filename.split('.').pop().toLowerCase();
          const mimeTypes = { html: 'text/html', css: 'text/css', js: 'application/javascript', json: 'application/json', svg: 'image/svg+xml' };
          res.setHeader('Content-Type', mimeTypes[ext] || 'text/plain');
          return res.send(files[filename]);
        }
      }
      const html = files['index.html'] || files['public/index.html'] || project.current_html;
      if (html) {
        res.setHeader('Content-Type', 'text/html');
        return res.send(html);
      }
    }
  } catch (e) {
    // Supabase not configured yet — skip
  }

  next();
});

// ── Static Files ──────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));

// ── API Routes ────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/components', componentRoutes);
app.use('/api/stripe', stripeRoutes);

// ── Published Sites (public, no auth) ─────────────
app.use('/live', publishRoutes);

// ── Health Check ──────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── SPA Fallback (serve index.html for non-API routes) ──
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api') && !req.path.startsWith('/live')) {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  }
});

// ── Start Server ──────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n  ⚡ Qntum Designs Server`);
  console.log(`  → http://localhost:${PORT}`);
  console.log(`  → Environment: ${process.env.NODE_ENV || 'development'}\n`);
});
