const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);

// GET /api/components/search?category=hero&q=gradient
router.get('/search', async (req, res) => {
  const { category, q } = req.query;
  const apiKey = process.env.TWENTYFIRST_API_KEY;

  if (!apiKey) {
    return res.status(503).json({ error: '21st.dev API nicht konfiguriert' });
  }

  try {
    const params = new URLSearchParams();
    if (q) params.append('search', q);
    if (category && category !== 'all') params.append('tag', category);
    params.append('limit', '20');

    const response = await fetch(`https://api.21st.dev/v1/components/search?${params}`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('21st.dev API error:', response.status, errText);
      throw new Error(`21st.dev API error: ${response.status}`);
    }

    const data = await response.json();

    const components = (data.components || data.results || []).map(c => ({
      id: c.id || c.slug,
      name: c.name || c.title,
      category: c.category || c.tag || 'other',
      thumbnail: c.preview_url || c.thumbnail_url || c.image_url || null,
      tags: c.tags || [],
      prompt: c.description
        ? `Erstelle eine ${c.name} Komponente: ${c.description}`
        : `Erstelle eine ${c.name} Komponente im modernen Stil.`,
      code: c.code || null,
      proOnly: false
    }));

    res.json({ components });
  } catch (err) {
    console.error('21st.dev search error:', err.message);
    res.status(500).json({ error: 'Komponenten konnten nicht geladen werden' });
  }
});

// GET /api/components/categories
router.get('/categories', (req, res) => {
  res.json({
    categories: [
      { id: 'all', label: 'Alle' },
      { id: 'hero', label: 'Hero' },
      { id: 'features', label: 'Features' },
      { id: 'pricing', label: 'Pricing' },
      { id: 'cta', label: 'CTA' },
      { id: 'testimonials', label: 'Testimonials' },
      { id: 'footer', label: 'Footer' },
      { id: 'nav', label: 'Navigation' },
      { id: 'faq', label: 'FAQ' },
      { id: 'stats', label: 'Stats' },
      { id: 'contact', label: 'Kontakt' }
    ]
  });
});

module.exports = router;
