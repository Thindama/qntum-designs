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

function getHtmlSystemPrompt(projectFiles, skillAddons) {
  const hasFiles = projectFiles && Object.keys(projectFiles).length > 0;

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

KOMPAKTER CODE — WICHTIG:
- KEINE Kommentare im Code (weder HTML noch CSS noch JS)
- CSS: Shorthand Properties nutzen (margin, padding, border, background, font)
- CSS: Ähnliche Selektoren kombinieren (h1,h2,h3{...})
- CSS: Keine redundanten Deklarationen oder Resets die der Browser schon hat
- JS: Kurze Variablennamen für lokale Variablen, kompakte Event-Handler
- HTML: Keine überflüssigen Wrapper-Divs, semantische Tags direkt nutzen
- Ziel: Maximale visuelle Qualität bei minimalem Code-Umfang

${hasFiles && projectFiles['index.html']
    ? `AKTUELLE WEBSITE (übernimm als Basis, ändere nur was gewünscht wird):

\`\`\`html
<!-- FILE: index.html -->
${projectFiles['index.html']}
\`\`\``
    : 'Erstelle eine neue Website basierend auf der Beschreibung des Nutzers.'}

${skillAddons ? '\n' + skillAddons : ''}`;
}

function getReactSystemPrompt(projectFiles, skillAddons) {
  const hasFiles = projectFiles && Object.keys(projectFiles).length > 0;
  const fileList = hasFiles ? Object.keys(projectFiles) : [];

  return `Du bist Qntum, ein erstklassiger KI-Webdesigner. Du erstellst visuell beeindruckende, produktionsreife Websites mit React und Tailwind CSS.

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
1. Antworte auf Deutsch. Beschreibe in 1-2 Sätzen was du erstellt/geändert hast.
2. Nutze React (functional components mit Hooks) + Tailwind CSS Utility-Klassen.
3. App.jsx ist die Hauptdatei — importiere alle Komponenten dort.
4. Erstelle eigenständige Komponenten in components/*.jsx
5. Kein Backend, kein server.js, kein SQL — NUR Frontend.
6. Design: Visuell beeindruckend, modern, einzigartig, professionell.
7. Tailwind-Klassen direkt nutzen. Bei Bedarf: Google Fonts via CDN.
8. Bei Änderungen: Gib nur die geänderten Dateien als vollständige Dateien aus.
9. Die Komponenten werden live in einem Sandpack-Runner gerendert.

VERFÜGBARE PAKETE (kannst du importieren):
- react, react-dom
- tailwindcss (via CDN)
- lucide-react (Icons)
- framer-motion (Animationen)

KOMPAKTER CODE — WICHTIG:
- KEINE Kommentare im Code
- Tailwind-Klassen bevorzugen statt custom CSS
- Komponenten schlank halten, Props nutzen
- Ziel: Maximale visuelle Qualität bei minimalem Code-Umfang

${hasFiles && fileList.length > 0
    ? `AKTUELLE PROJEKT-DATEIEN (übernimm als Basis, ändere nur was gewünscht wird):

${fileList.map(f => `\`\`\`${f.endsWith('.jsx') || f.endsWith('.tsx') ? 'jsx' : f.endsWith('.css') ? 'css' : f.endsWith('.json') ? 'json' : 'text'}
// FILE: ${f}
${projectFiles[f]}
\`\`\``).join('\n\n')}`
    : 'Erstelle ein neues React-Projekt basierend auf der Beschreibung des Nutzers. Beginne mit App.jsx als Hauptkomponente.'}

${skillAddons ? '\n' + skillAddons : ''}`;
}

function getSystemPrompt(projectFiles, activeSkills, stack) {
  const skillAddons = (activeSkills || [])
    .map(s => SKILL_PROMPTS[s])
    .filter(Boolean)
    .join('\n\n');

  if (stack === 'react') {
    return getReactSystemPrompt(projectFiles, skillAddons);
  }
  return getHtmlSystemPrompt(projectFiles, skillAddons);
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
