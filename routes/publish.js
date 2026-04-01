const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../db/supabase');

/**
 * GET /live/:slug — Serve a published website (public, no auth needed)
 */
router.get('/:slug', async (req, res) => {
  try {
    const { data: project, error } = await supabaseAdmin
      .from('projects')
      .select('current_html, project_files, name, status, slug')
      .eq('slug', req.params.slug)
      .eq('status', 'live')
      .single();

    if (error || !project) {
      return res.status(404).send(getNotFoundPage());
    }

    // Serve the index.html from project files, or current_html fallback
    const files = project.project_files || {};
    const html = files['index.html'] || files['public/index.html'] || project.current_html;

    if (!html) {
      return res.status(404).send(getNotFoundPage());
    }

    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (err) {
    console.error('Serve published site error:', err);
    res.status(500).send('Server Error');
  }
});

/**
 * GET /live/:slug/:filename — Serve additional project files (JS, CSS, etc.)
 */
router.get('/:slug/:filename', async (req, res) => {
  try {
    const { data: project, error } = await supabaseAdmin
      .from('projects')
      .select('project_files')
      .eq('slug', req.params.slug)
      .eq('status', 'live')
      .single();

    if (error || !project) {
      return res.status(404).send('Not found');
    }

    const files = project.project_files || {};
    const content = files[req.params.filename];

    if (!content) {
      return res.status(404).send('File not found');
    }

    // Set content type based on extension
    const ext = req.params.filename.split('.').pop().toLowerCase();
    const mimeTypes = {
      html: 'text/html', css: 'text/css', js: 'application/javascript',
      json: 'application/json', svg: 'image/svg+xml', txt: 'text/plain'
    };
    res.setHeader('Content-Type', mimeTypes[ext] || 'text/plain');
    res.send(content);
  } catch (err) {
    res.status(500).send('Server Error');
  }
});

function getNotFoundPage() {
  return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Nicht gefunden — Qntum</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{min-height:100vh;display:flex;align-items:center;justify-content:center;background:#08080F;color:#E2E2F0;font-family:'Manrope',system-ui,sans-serif;text-align:center}
.c{max-width:400px;padding:40px}
h1{font-size:72px;font-weight:800;background:linear-gradient(135deg,#00E68A,#00D4FF);-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin-bottom:16px}
p{color:#8888A8;font-size:15px;line-height:1.6;margin-bottom:24px}
a{color:#00E68A;text-decoration:none;font-weight:600;font-size:14px}
a:hover{text-decoration:underline}
</style>
</head>
<body>
<div class="c">
<h1>404</h1>
<p>Diese Website existiert nicht oder wurde noch nicht veröffentlicht.</p>
<a href="https://qntum.design">→ Erstelle deine eigene mit Qntum</a>
</div>
</body>
</html>`;
}

module.exports = router;
