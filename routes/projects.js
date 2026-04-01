const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../db/supabase');
const { requireAuth } = require('../middleware/auth');

// All routes require authentication
router.use(requireAuth);

// GET /api/projects — list user's projects
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('projects')
      .select('id, name, description, status, thumbnail_color, current_html, project_files, created_at, updated_at')
      .eq('user_id', req.userId)
      .order('updated_at', { ascending: false });

    if (error) throw error;

    // Add version count and message count for each project
    const projects = await Promise.all(data.map(async (project) => {
      const { count: versionCount } = await supabaseAdmin
        .from('versions')
        .select('*', { count: 'exact', head: true })
        .eq('project_id', project.id);

      const { count: messageCount } = await supabaseAdmin
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('project_id', project.id);

      return {
        ...project,
        has_preview: !!project.current_html,
        file_count: project.project_files ? Object.keys(project.project_files).length : 0,
        version_count: versionCount || 0,
        message_count: messageCount || 0,
        // Don't send full content in list view
        current_html: undefined,
        project_files: undefined
      };
    }));

    res.json(projects);
  } catch (err) {
    console.error('List projects error:', err);
    res.status(500).json({ error: 'Projekte konnten nicht geladen werden' });
  }
});

// POST /api/projects — create new project
router.post('/', async (req, res) => {
  const { name, description } = req.body;

  try {
    // Ensure profile exists (FK constraint: projects.user_id → profiles.id)
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('id', req.userId)
      .maybeSingle();

    if (!profile) {
      // Profile missing (e.g. trigger failed during registration) — create it now
      const { data: { user } } = await supabaseAdmin.auth.admin.getUserById(req.userId);
      await supabaseAdmin.from('profiles').upsert({
        id: req.userId,
        name: user?.user_metadata?.name || '',
        email: user?.email || '',
        plan: 'free',
        tokens_used: 0,
        tokens_limit: 500000
      }, { onConflict: 'id' });
    }

    const { data, error } = await supabaseAdmin
      .from('projects')
      .insert({
        user_id: req.userId,
        name: name || 'Neues Projekt',
        description: description || '',
        status: 'draft'
      })
      .select()
      .single();

    if (error) throw error;

    res.status(201).json(data);
  } catch (err) {
    console.error('Create project error:', err);
    res.status(500).json({ error: 'Projekt konnte nicht erstellt werden' });
  }
});

// GET /api/projects/:id — get single project with full data
router.get('/:id', async (req, res) => {
  try {
    const { data: project, error } = await supabaseAdmin
      .from('projects')
      .select('*')
      .eq('id', req.params.id)
      .eq('user_id', req.userId)
      .single();

    if (error || !project) {
      return res.status(404).json({ error: 'Projekt nicht gefunden' });
    }

    // Get messages
    const { data: messages } = await supabaseAdmin
      .from('messages')
      .select('*')
      .eq('project_id', project.id)
      .order('created_at', { ascending: true });

    // Get versions
    const { data: versions } = await supabaseAdmin
      .from('versions')
      .select('id, label, created_at')
      .eq('project_id', project.id)
      .order('created_at', { ascending: false });

    res.json({
      ...project,
      messages: messages || [],
      versions: versions || []
    });
  } catch (err) {
    console.error('Get project error:', err);
    res.status(500).json({ error: 'Projekt konnte nicht geladen werden' });
  }
});

// PATCH /api/projects/:id — update project
router.patch('/:id', async (req, res) => {
  const { name, description, status } = req.body;
  const updates = {};

  if (name !== undefined) updates.name = name;
  if (description !== undefined) updates.description = description;
  if (status !== undefined) updates.status = status;
  updates.updated_at = new Date().toISOString();

  try {
    const { data, error } = await supabaseAdmin
      .from('projects')
      .update(updates)
      .eq('id', req.params.id)
      .eq('user_id', req.userId)
      .select()
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Projekt nicht gefunden' });

    res.json(data);
  } catch (err) {
    console.error('Update project error:', err);
    res.status(500).json({ error: 'Projekt konnte nicht aktualisiert werden' });
  }
});

// DELETE /api/projects/:id — delete project
router.delete('/:id', async (req, res) => {
  try {
    const { error } = await supabaseAdmin
      .from('projects')
      .delete()
      .eq('id', req.params.id)
      .eq('user_id', req.userId);

    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    console.error('Delete project error:', err);
    res.status(500).json({ error: 'Projekt konnte nicht gelöscht werden' });
  }
});

// POST /api/projects/:id/publish — publish with slug + optional custom domain
router.post('/:id/publish', async (req, res) => {
  const { slug, custom_domain } = req.body;

  if (!slug || !/^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$/.test(slug)) {
    return res.status(400).json({ error: 'Slug muss 3-50 Zeichen lang sein (a-z, 0-9, Bindestriche). Darf nicht mit Bindestrich beginnen oder enden.' });
  }

  try {
    // Check if project has content
    const { data: project } = await supabaseAdmin
      .from('projects')
      .select('current_html, project_files')
      .eq('id', req.params.id)
      .eq('user_id', req.userId)
      .single();

    if (!project) return res.status(404).json({ error: 'Projekt nicht gefunden' });

    const hasContent = project.current_html || (project.project_files && Object.keys(project.project_files).length > 0);
    if (!hasContent) return res.status(400).json({ error: 'Erstelle zuerst eine Website per Chat, bevor du veröffentlichst.' });

    // Check slug uniqueness (exclude own project)
    const { data: existing } = await supabaseAdmin
      .from('projects')
      .select('id')
      .eq('slug', slug)
      .neq('id', req.params.id)
      .maybeSingle();

    if (existing) return res.status(409).json({ error: 'Dieser Slug ist bereits vergeben. Wähle einen anderen.' });

    // Check custom domain uniqueness
    if (custom_domain) {
      const domainClean = custom_domain.toLowerCase().trim().replace(/^https?:\/\//, '').replace(/\/+$/, '');
      const { data: domainTaken } = await supabaseAdmin
        .from('projects')
        .select('id')
        .eq('custom_domain', domainClean)
        .neq('id', req.params.id)
        .maybeSingle();

      if (domainTaken) return res.status(409).json({ error: 'Diese Domain wird bereits verwendet.' });
    }

    // Publish
    const updates = {
      status: 'live',
      slug,
      custom_domain: custom_domain ? custom_domain.toLowerCase().trim().replace(/^https?:\/\//, '').replace(/\/+$/, '') : null,
      published_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabaseAdmin
      .from('projects')
      .update(updates)
      .eq('id', req.params.id)
      .eq('user_id', req.userId)
      .select()
      .single();

    if (error) throw error;

    const appDomain = process.env.APP_DOMAIN || req.get('host');
    res.json({
      success: true,
      project: data,
      liveUrl: `${req.protocol}://${appDomain}/live/${slug}`,
      customDomain: data.custom_domain || null
    });
  } catch (err) {
    console.error('Publish error:', err);
    res.status(500).json({ error: 'Veröffentlichung fehlgeschlagen' });
  }
});

// POST /api/projects/:id/unpublish — take offline
router.post('/:id/unpublish', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('projects')
      .update({ status: 'draft', updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .eq('user_id', req.userId)
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, project: data });
  } catch (err) {
    res.status(500).json({ error: 'Konnte nicht offline genommen werden' });
  }
});

// GET /api/projects/:id/versions — get version history
router.get('/:id/versions', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('versions')
      .select('*')
      .eq('project_id', req.params.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: 'Versionen konnten nicht geladen werden' });
  }
});

// POST /api/projects/:id/versions/:versionId/restore — restore a version
router.post('/:id/versions/:versionId/restore', async (req, res) => {
  try {
    const { data: version, error: vErr } = await supabaseAdmin
      .from('versions')
      .select('html')
      .eq('id', req.params.versionId)
      .eq('project_id', req.params.id)
      .single();

    if (vErr || !version) {
      return res.status(404).json({ error: 'Version nicht gefunden' });
    }

    // Version.html may be a JSON string of project_files or raw HTML
    let projectFiles = {};
    let previewHtml = '';
    try {
      projectFiles = JSON.parse(version.html);
      previewHtml = projectFiles['index.html'] || projectFiles['public/index.html'] || '';
    } catch {
      // Legacy: raw HTML string
      previewHtml = version.html;
      projectFiles = { 'index.html': version.html };
    }

    const { error: uErr } = await supabaseAdmin
      .from('projects')
      .update({
        project_files: projectFiles,
        current_html: previewHtml,
        updated_at: new Date().toISOString()
      })
      .eq('id', req.params.id)
      .eq('user_id', req.userId);

    if (uErr) throw uErr;
    res.json({ success: true, files: projectFiles, html: previewHtml });
  } catch (err) {
    res.status(500).json({ error: 'Version konnte nicht wiederhergestellt werden' });
  }
});

// GET /api/projects/:id/files — get all project files as JSON (for export)
router.get('/:id/files', async (req, res) => {
  try {
    const { data: project, error } = await supabaseAdmin
      .from('projects')
      .select('name, project_files, current_html')
      .eq('id', req.params.id)
      .eq('user_id', req.userId)
      .single();

    if (error || !project) {
      return res.status(404).json({ error: 'Projekt nicht gefunden' });
    }

    const files = project.project_files || {};
    // Fallback: if no multi-file structure, use current_html
    if (!Object.keys(files).length && project.current_html) {
      files['index.html'] = project.current_html;
    }

    res.json({ name: project.name, files });
  } catch (err) {
    res.status(500).json({ error: 'Dateien konnten nicht geladen werden' });
  }
});

module.exports = router;
