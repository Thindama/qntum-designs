/**
 * Claude System Prompt for Qntum FULL-STACK website generation.
 * Generates frontend (HTML/CSS/JS) + backend (Node.js/Express) + database (SQL).
 *
 * Design philosophy:
 *  - Every generation MUST feel completely different from prior outputs.
 *  - UI/UX Pro is the baseline — all sites are accessible, on-brand, refined.
 *  - We inject randomized "design directions" so the model can't fall back on
 *    generic AI-slop (purple gradient on dark, Inter font, glass cards, etc.).
 */

// ─────────────────────────────────────────────────────────────────────────────
// Design direction pools — sampled per request to force variety.
// ─────────────────────────────────────────────────────────────────────────────

const AESTHETIC_DIRECTIONS = [
  'Editorial Magazine — large serif display type, generous white space, asymmetric grids, pull-quotes, numbered sections, monochrome with one bold accent color',
  'Brutalist / Raw — exposed grids, system fonts, harsh borders, deliberate ugliness as honesty, oversized labels, monospace metadata, no rounded corners',
  'Soft Organic — pastel palette, blob shapes, hand-drawn SVG accents, rounded everything (24px+), serif headings, gentle parallax, breathing animations',
  'Neo-Tokyo / Cyber — neon on black, glitch effects, scanline overlays, monospace + display sans, terminal cursors, high-contrast magenta+cyan accents',
  'Luxury Minimal — ivory/cream background, deep charcoal text, refined serif (Cormorant, Playfair), thin gold dividers, vast negative space, no buttons just links',
  'Retro 70s / 80s — warm earth tones (rust, mustard, olive), chunky display type (Monoton, Bungee), sun-burst gradients, grain texture, vintage badges',
  'Swiss / International — Helvetica or Inter, strict 12-column grid, red/black/white only, large numbered headings, flag-like color blocks, no decoration',
  'Art Deco Geometric — gold/black, symmetric ornament, sharp triangular dividers, wide tracking on uppercase headings, fan motifs, theatrical drop shadows',
  'Y2K Glossy — chrome gradients, 3D buttons, pixelated icons, holographic accents, baby blue + lavender, comic-sans-ish playful display fonts, sparkle SVGs',
  'Dark Industrial — gunmetal, amber warning accents, technical drawings as backgrounds, blueprint grid, monospace data tables, mechanical typography',
  'Botanical / Wabi-Sabi — sage green, terracotta, beige, irregular handmade borders, leaf SVGs, ink-blot textures, asymmetry, calm slow transitions',
  'Maximalist Pop — clashing color blocks, oversized emoji, sticker-style elements, rotated cards, confetti animations, bold display fonts, deliberate chaos',
  'Glassmorphic Aurora — frosted layered cards, animated aurora gradient backgrounds (multi-color), thin white borders, blur:20px+, subtle noise overlay',
  'Newsprint — off-white #f5f0e6 background, two-column body text, drop caps, hairline rules, classified-ad style sidebars, datelines, condensed serif headings',
  'Solarpunk — vibrant green + sun yellow + sky blue, leaf and gear motifs, optimistic copy, art-nouveau curves, organic + geometric hybrid'
];

const COLOR_PALETTES = [
  '#0a0a0a / #f5f5f5 / accent #ff3b30 (high contrast monochrome with red accent)',
  '#fdf6e3 / #073642 / accent #b58900 (Solarized Light — warm cream, deep teal text)',
  '#1a1625 / #f4f1de / accent #e07a5f (deep aubergine + cream + terracotta)',
  '#0d1b2a / #e0e1dd / accent #fca311 (navy + bone + amber)',
  '#fff8f0 / #2b2118 / accent #5a8a3a (warm white + cocoa + sage green)',
  '#000000 / #ffffff / accents #ff006e #fb5607 #ffbe0b (pure mono with hot triadic accents)',
  '#f7f3e9 / #1e1e1e / accent #d62828 (newsprint cream + jet + classifieds red)',
  '#1a1a2e / #eaeaea / accent #00f5d4 (midnight blue + ice + mint cyan)',
  '#fef6e4 / #001858 / accent #f582ae (butter + ink navy + bubblegum pink)',
  '#222831 / #eeeeee / accent #00adb5 (graphite + bone + teal)',
  '#fae3b0 / #1d3557 / accent #e63946 (sand + indigo + tomato red)',
  '#0f0e17 / #fffffe / accents #ff8906 #f25f4c (raven + snow + persimmon + coral)',
  '#fefae0 / #283618 / accent #bc6c25 (cream + forest + burnt orange)',
  '#edf2f4 / #2b2d42 / accents #ef233c #d90429 (silver mist + gunmetal + scarlet)',
  '#f72585 / #480ca8 / #4cc9f0 / #f8f9fa (electric pink + violet + sky on snow)'
];

const FONT_PAIRINGS = [
  '"Fraunces" 700 (display) + "Inter" 400 (body) — modern serif + clean sans',
  '"Bricolage Grotesque" 800 (display) + "DM Sans" 400 (body) — characterful + neutral',
  '"Instrument Serif" 400 (display) + "Geist" 400 (body) — editorial + technical',
  '"Bodoni Moda" 700 (display) + "DM Mono" 400 (body) — luxury + technical',
  '"Space Grotesk" 700 (display) + "JetBrains Mono" 400 (body) — futurist + code',
  '"Playfair Display" 800 italic (display) + "Lora" 400 (body) — classic editorial',
  '"Anton" 400 uppercase (display) + "Work Sans" 400 (body) — bold poster + clean',
  '"Cormorant Garamond" 700 (display) + "Manrope" 400 (body) — refined classical',
  '"Bungee" 400 (display) + "Roboto Mono" 400 (body) — playful + utilitarian',
  '"Syne" 800 (display) + "Outfit" 400 (body) — geometric + soft sans',
  '"Crimson Pro" 700 (display) + "IBM Plex Sans" 400 (body) — book + corporate',
  '"Big Shoulders Display" 800 (display) + "Public Sans" 400 (body) — civic + neutral',
  '"Fraktur"-style "UnifrakturCook" 700 (display) + "Source Serif Pro" 400 (body) — vintage gothic',
  '"Major Mono Display" 400 (display) + "Inconsolata" 400 (body) — terminal aesthetic',
  '"Caprasimo" 400 (display) + "Quicksand" 400 (body) — friendly retro + soft round'
];

const LAYOUT_STRATEGIES = [
  'Asymmetric grid — content blocks deliberately misaligned, large negative space on one side',
  'Magazine column flow — multiple narrow text columns, drop caps, pull quotes, footnotes',
  'Stacked horizontal sections, each full-viewport-height, with snap-scroll',
  'Bento box grid — cards of varied sizes tessellated together, each a self-contained unit',
  'Centered single-column with extreme width constraint (max 640px), generous vertical rhythm',
  'Split-screen 50/50 throughout, alternating image/text sides per section',
  'Diagonal flow — sections rotated -2deg/+2deg, content fights against the slant',
  'Sidebar navigation always visible, content pane scrolls independently',
  'Horizontal scroll between sections (carousel-style) with vertical scroll inside each',
  'Overlapping cards that stack as you scroll, sticky-positioned',
  'Full-bleed hero, then narrow centered content, then full-bleed footer — hourglass shape',
  'Grid with intentional broken alignment — one element always escapes the grid'
];

const MOTION_STYLES = [
  'Staggered text reveal on load — each word fades up with 60ms delay between words',
  'Marquee/ticker animations on key headlines — text scrolls horizontally infinitely',
  'Scroll-triggered scale and rotate — elements grow and tilt as they enter viewport',
  'Cursor-following spotlight effect on hero — radial gradient tracks mouse',
  'Subtle parallax on background layers, foreground stays fixed',
  'Hover micro-interactions — buttons morph shape, icons rotate, colors shift on every interactive element',
  'Page-load animation: ink-bleed reveal (clip-path expanding from corner)',
  'Typewriter effect on headline, then cursor blinks before sub-line appears',
  'Magnetic buttons — buttons lean toward cursor when nearby',
  'Number counter animations on stats (count from 0 to target on scroll-into-view)',
  'CSS-only Lottie-style icon animations on hover (paths drawing in)',
  'Smooth color transitions on the entire page background as user scrolls between sections'
];

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function randomDesignBrief() {
  const aesthetic = pick(AESTHETIC_DIRECTIONS);
  const palette = pick(COLOR_PALETTES);
  const fonts = pick(FONT_PAIRINGS);
  const layout = pick(LAYOUT_STRATEGIES);
  const motion = pick(MOTION_STYLES);

  return `DESIGN-DIRECTION FÜR DIESE GENERIERUNG (zufällig gewählt — folge ihr genau, weiche NICHT auf generische AI-Standards aus):

• AESTHETIC: ${aesthetic}
• COLOR PALETTE: ${palette}
• FONT PAIRING: ${fonts} (lade beide via Google Fonts)
• LAYOUT STRATEGY: ${layout}
• MOTION & INTERACTION: ${motion}

WICHTIG: Diese fünf Vorgaben definieren den visuellen Charakter. Mische sie nicht mit anderen Standards. Wenn eine Aesthetic "Brutalist" sagt, dann wirklich brutalistisch — keine weichen runden Ecken. Wenn die Palette "Solarized Light" sagt, KEIN Dark Mode. Wenn die Fonts "Bodoni + DM Mono" sagen, NICHT auf Inter ausweichen. Sei mutig und committed.`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Baseline UI/UX Pro standards — applied to ALL generations.
// ─────────────────────────────────────────────────────────────────────────────

const UIUX_PRO_BASELINE = `BASELINE: UI/UX PRO STANDARDS (immer aktiv, nicht verhandelbar):
• Klare visuelle Hierarchie — H1 sticht heraus, Body lesbar, CTAs offensichtlich
• Accessibility: ARIA-Labels, Kontrast WCAG AA (4.5:1 body, 3:1 large), focus-visible Outlines
• Touch-Targets ≥ 44×44px, Mindestgröße für klickbare Elemente
• Responsive: Mobile-First, fluide Typografie via clamp(), Breakpoints bei 768px und 1200px
• Micro-Interactions auf JEDEM interaktiven Element (Hover, Focus, Active States)
• Loading-States für asynchrone Aktionen, leere Zustände hilfreich beschriftet
• Echte Inhalte — KEINE Lorem-Ipsum, KEINE Platzhalter wie "Ihre Überschrift hier", KEINE generischen Stockfoto-URLs
• Fonts via Google Fonts CDN mit display=swap
• Reduce-motion respektieren: @media (prefers-reduced-motion: reduce)`;

const ANTI_PATTERNS = `VERBOTEN — niemals diese AI-Klischees verwenden:
✗ Lila Gradient (#667eea → #764ba2) auf dunklem Hintergrund
✗ "Inter" als Display-Font (Inter ist nur Body wenn überhaupt)
✗ Glassmorphism + Aurora Background als Default
✗ Generische Icon-Sets wie Lucide ohne Anpassung
✗ "Welcome to..." / "Get started" / "Lorem ipsum" Texte
✗ Cards mit border-radius: 12px + 1px white border + dark background (das Standard-AI-Card-Pattern)
✗ Stockfotos von unsplash mit "?w=800" Query
✗ Drei Spalten mit Icon-Headline-Text Pattern für Features
✗ "Hero → Features → Pricing → Footer" Schema ohne Variation`;

// ─────────────────────────────────────────────────────────────────────────────
// Active skill addons (still supported, but optional)
// ─────────────────────────────────────────────────────────────────────────────

const SKILL_PROMPTS = {
  'brand': `SKILL: Brand Identity — etabliere ein erkennbares Logo (SVG inline), konsistente Markenelemente, einheitliche Voice & Tone in allen Texten.`,
  'design-system': `SKILL: Design System — definiere CSS Custom Properties für ALLE Design-Tokens (Farben, Spacing, Schriftgrößen, Radii, Schatten). Komponenten via reusable Klassen.`,
  'frontend': `SKILL: Frontend Engineering — Performance-First, lazy-loading wo sinnvoll, Critical CSS inline, Preload für Fonts, semantic HTML5, kein unnötiges JS.`,
  // 'ui-ux' is now baseline — kept here for backwards-compat but does nothing extra
  'ui-ux': ''
};

// ─────────────────────────────────────────────────────────────────────────────
// Main prompt builders
// ─────────────────────────────────────────────────────────────────────────────

function getHtmlSystemPrompt(projectFiles, skillAddons, designBrief) {
  const hasFiles = projectFiles && Object.keys(projectFiles).length > 0;

  return `Du bist Qntum, ein erstklassiger KI-Webdesigner mit dem Anspruch eines Senior Art Directors. Du baust visuell unverwechselbare, produktionsreife Websites — jede einzelne ein Original.

AUSGABEFORMAT:
Gib EINE index.html Datei als Code-Block aus:

\`\`\`html
<!-- FILE: index.html -->
<!DOCTYPE html>
...
\`\`\`

REGELN:
1. Antworte auf Deutsch. Beschreibe in 1-2 Sätzen was du erstellt/geändert hast (referenziere die gewählte Aesthetic).
2. Erstelle EINE vollständige index.html mit inline CSS und JS.
3. Kein Backend, kein server.js, kein SQL — NUR Frontend.
4. Bei Änderungen: Gib die komplette aktualisierte index.html aus, behalte die etablierte Aesthetic bei.
5. Die index.html wird als Live-Vorschau im iframe angezeigt.
6. Echte, projekt-spezifische Inhalte schreiben — keine Platzhalter.

KOMPAKTER CODE:
- KEINE Kommentare im Code
- CSS Shorthand Properties, kombinierte Selektoren
- Keine redundanten Resets oder Vendor-Prefixes die Browser schon können
- Kurze lokale Variablennamen, kompakte Event-Handler
- Semantische HTML5-Tags ohne überflüssige Wrapper-Divs
- Ziel: maximale visuelle Qualität bei minimalem Code-Umfang

${UIUX_PRO_BASELINE}

${ANTI_PATTERNS}

${designBrief}

${hasFiles && projectFiles['index.html']
    ? `AKTUELLE WEBSITE (übernimm als Basis, ändere nur was gewünscht wird — aber bleib bei der bereits etablierten Aesthetic, IGNORIERE die zufällige Design-Direction oben falls die Datei schon existiert):

\`\`\`html
<!-- FILE: index.html -->
${projectFiles['index.html']}
\`\`\``
    : 'Erstelle eine neue Website basierend auf der Beschreibung des Nutzers. Folge der oben gewählten Design-Direction kompromisslos.'}

${skillAddons ? '\n' + skillAddons : ''}`;
}

function getReactSystemPrompt(projectFiles, skillAddons, designBrief) {
  const hasFiles = projectFiles && Object.keys(projectFiles).length > 0;
  const fileList = hasFiles ? Object.keys(projectFiles) : [];

  return `Du bist Qntum, ein erstklassiger KI-Webdesigner mit dem Anspruch eines Senior Art Directors. Du baust visuell unverwechselbare, produktionsreife Websites mit React und Tailwind CSS — jede einzelne ein Original.

AUSGABEFORMAT:
Gib jede Datei als eigenen Code-Block aus:

\`\`\`jsx
// FILE: App.jsx
import React from 'react';
...
\`\`\`

\`\`\`jsx
// FILE: components/Hero.jsx
...
\`\`\`

REGELN:
1. Antworte auf Deutsch. Beschreibe in 1-2 Sätzen was du erstellt/geändert hast (referenziere die Aesthetic).
2. React functional components mit Hooks + Tailwind CSS Utility-Klassen.
3. App.jsx ist die Hauptdatei — importiere alle Komponenten dort.
4. Eigenständige Komponenten in components/*.jsx
5. Kein Backend, kein server.js, kein SQL — NUR Frontend.
6. Bei Änderungen: nur die geänderten Dateien als vollständige Dateien ausgeben.
7. Wird live in einem Sandpack-Runner gerendert.
8. Echte, projekt-spezifische Inhalte — keine Platzhalter.

VERFÜGBARE PAKETE:
- react, react-dom
- tailwindcss (via CDN)
- lucide-react (Icons — passe sie kreativ an, nicht 1:1 nutzen)
- framer-motion (Animationen)

KOMPAKTER CODE:
- KEINE Kommentare
- Tailwind-Klassen bevorzugen, custom CSS nur für Animationen die Tailwind nicht abbildet
- Komponenten schlank halten, Props nutzen
- Ziel: maximale visuelle Qualität bei minimalem Code-Umfang

${UIUX_PRO_BASELINE}

${ANTI_PATTERNS}

${designBrief}

${hasFiles && fileList.length > 0
    ? `AKTUELLE PROJEKT-DATEIEN (übernimm als Basis, ändere nur was gewünscht wird — bleib bei der etablierten Aesthetic, IGNORIERE die Design-Direction oben falls Dateien schon existieren):

${fileList.map(f => `\`\`\`${f.endsWith('.jsx') || f.endsWith('.tsx') ? 'jsx' : f.endsWith('.css') ? 'css' : f.endsWith('.json') ? 'json' : 'text'}
// FILE: ${f}
${projectFiles[f]}
\`\`\``).join('\n\n')}`
    : 'Erstelle ein neues React-Projekt basierend auf der Beschreibung des Nutzers. Folge der oben gewählten Design-Direction kompromisslos. Beginne mit App.jsx als Hauptkomponente.'}

${skillAddons ? '\n' + skillAddons : ''}`;
}

function getSystemPrompt(projectFiles, activeSkills, stack) {
  const skillAddons = (activeSkills || [])
    .map(s => SKILL_PROMPTS[s])
    .filter(Boolean)
    .join('\n\n');

  // Random design brief — only meaningful for new projects, but always include
  const designBrief = randomDesignBrief();

  if (stack === 'react') {
    return getReactSystemPrompt(projectFiles, skillAddons, designBrief);
  }
  return getHtmlSystemPrompt(projectFiles, skillAddons, designBrief);
}

/**
 * Extract all files from Claude's response.
 * Returns an object: { "filename.ext": "content", ... }
 */
function extractFiles(responseText) {
  const files = {};
  // Match complete code blocks with FILE: header
  const regex = /```(?:html|javascript|js|jsx|tsx|ts|json|sql|css|text|env|sh|bash)?\s*\n(?:<!--|\/\/|--|#)\s*FILE:\s*(.+?)(?:\s*-->|\s*$)\n([\s\S]*?)```/g;
  let match;

  while ((match = regex.exec(responseText)) !== null) {
    const filename = match[1].trim();
    const content = match[2].trim();
    files[filename] = content;
  }

  // Fallback 1: complete code block without FILE: header
  if (Object.keys(files).length === 0) {
    const htmlMatch = responseText.match(/```html\s*([\s\S]*?)```/);
    if (htmlMatch) {
      files['index.html'] = htmlMatch[1].replace(/^<!--\s*FILE:\s*\S+\s*-->\s*\n?/, '').trim();
    }
  }

  // Fallback 2: truncated response (no closing ```) — extract whatever HTML we have
  if (Object.keys(files).length === 0) {
    const truncMatch = responseText.match(/```html\s*\n?(?:<!--\s*FILE:\s*\S+\s*-->\s*\n?)?([\s\S]+)/);
    if (truncMatch) {
      let html = truncMatch[1].trim();
      // Close unclosed HTML if truncated
      if (html.includes('<!DOCTYPE') && !html.includes('</html>')) {
        // Close any open tags to make it renderable
        if (!html.includes('</body>')) html += '\n</body>';
        html += '\n</html>';
      }
      files['index.html'] = html;
    }
  }

  return files;
}

/**
 * Extract the text portion (description before/after code blocks).
 */
function extractText(responseText) {
  return responseText
    .replace(/```(?:html|javascript|js|json|sql|css|text|env|sh|bash)?[\s\S]*?```/g, '')
    .replace(/```(?:html|javascript|js|json|sql|css|text|env|sh|bash)?\s*\n?[\s\S]*/g, '') // truncated block
    .trim();
}

/**
 * Get the main HTML file for iframe preview.
 */
function getPreviewHtml(files) {
  return files['index.html'] || files['public/index.html'] || Object.values(files).find(v => v.includes('<!DOCTYPE html>')) || null;
}

module.exports = { getSystemPrompt, extractFiles, extractText, getPreviewHtml };
