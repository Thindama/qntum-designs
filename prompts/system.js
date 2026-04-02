/**
 * Claude System Prompt for Qntum FULL-STACK website generation.
 * Generates frontend (HTML/CSS/JS) + backend (Node.js/Express) + database (SQL).
 */

const SKILL_PROMPTS = {
  'ui-ux': `ZUSÄTZLICHER FOKUS: UI/UX Pro-Modus aktiv. Achte besonders auf:
- Nutzererfahrung, intuitive Navigation, klare Call-to-Actions
- Accessibility (ARIA, Kontraste, Tastatur-Navigation)
- Micro-Interactions, Hover-Effekte, Loading-States
- Mobile-First Design, Touch-Targets mindestens 44px`,

  'brand': `ZUSÄTZLICHER FOKUS: Brand Identity-Modus aktiv. Achte besonders auf:
- Konsistente Farbpalette und Typografie durchgehend
- Logo-Integration und Brand-Elemente
- Einheitlicher visueller Stil in allen Sektionen
- Professionelle, wiedererkennbare Markenidentität`,

  'design-system': `ZUSÄTZLICHER FOKUS: Design System-Modus aktiv. Achte besonders auf:
- CSS Custom Properties für alle Farben, Abstände, Schriftgrößen
- Wiederverwendbare Komponenten-Klassen
- Konsistentes Spacing-System (4px/8px Grid)
- Typografie-Skala und einheitliche Border-Radius`,

  'frontend': `ZUSÄTZLICHER FOKUS: Frontend Design-Modus aktiv. Achte besonders auf:
- Visuell beeindruckende Animationen und Übergänge
- CSS Grid und Flexbox für komplexe Layouts
- Glassmorphism, Gradients, moderne visuelle Effekte
- Performance-optimiertes CSS, keine unnötigen Frameworks`
};

function getSystemPrompt(projectFiles, activeSkills) {
  const hasFiles = projectFiles && Object.keys(projectFiles).length > 0;
  const skillAddons = (activeSkills || [])
    .map(s => SKILL_PROMPTS[s])
    .filter(Boolean)
    .join('\n\n');

  return `Du bist Qntum, ein erstklassiger KI-Webdesigner. Du erstellst visuell beeindruckende, produktionsreife Websites als einzelne HTML-Dateien.

AUSGABEFORMAT:
Gib EINE index.html Datei als Code-Block aus:

\`\`\`html
<!-- FILE: index.html -->
<!DOCTYPE html>
...
\`\`\`

REGELN:
1. Antworte auf Deutsch. Beschreibe in 1-2 Sätzen was du erstellt/geändert hast.
2. Erstelle EINE vollständige index.html mit inline CSS und JS.
3. Kein Backend, kein server.js, kein SQL — NUR Frontend.
4. Design: Visuell beeindruckend, modern, einzigartig, professionell.
5. Google Fonts über CDN, CSS-Animationen, Gradients, responsive.
6. Bei Änderungen: Gib die komplette aktualisierte index.html aus.
7. Die index.html wird als Live-Vorschau im iframe angezeigt.
8. Halte den Code kompakt — keine unnötigen Kommentare.

${hasFiles && projectFiles['index.html']
    ? `AKTUELLE WEBSITE (übernimm als Basis, ändere nur was gewünscht wird):

\`\`\`html
<!-- FILE: index.html -->
${projectFiles['index.html']}
\`\`\``
    : 'Erstelle eine neue Website basierend auf der Beschreibung des Nutzers.'}

${skillAddons ? '\n' + skillAddons : ''}`;
}

/**
 * Extract all files from Claude's response.
 * Returns an object: { "filename.ext": "content", ... }
 */
function extractFiles(responseText) {
  const files = {};
  // Match code blocks with FILE: header
  const regex = /```(?:html|javascript|js|json|sql|css|text|env|sh|bash)?\s*\n(?:<!--|\/\/|--|#)\s*FILE:\s*(.+?)(?:\s*-->|\s*$)\n([\s\S]*?)```/g;
  let match;

  while ((match = regex.exec(responseText)) !== null) {
    const filename = match[1].trim();
    const content = match[2].trim();
    files[filename] = content;
  }

  // Fallback: if no FILE: headers found, try old single-HTML format
  if (Object.keys(files).length === 0) {
    const htmlMatch = responseText.match(/```html\s*([\s\S]*?)```/);
    if (htmlMatch) {
      files['index.html'] = htmlMatch[1].trim();
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
    .trim();
}

/**
 * Get the main HTML file for iframe preview.
 */
function getPreviewHtml(files) {
  return files['index.html'] || files['public/index.html'] || Object.values(files).find(v => v.includes('<!DOCTYPE html>')) || null;
}

module.exports = { getSystemPrompt, extractFiles, extractText, getPreviewHtml };
