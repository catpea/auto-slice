/**
 * TAR Archive Exporter
 * Exports all components, CSS, JSON, and an interactive index.html into a single .tar file
 */

import { TarWriter } from './tar-writer.js';

/**
 * Export complete project as TAR archive
 * @param {Object} gridConfig - Grid configuration
 * @param {Array} components - Array of component objects
 * @param {string} jsonContent - JSON export content
 * @param {string} cssContent - CSS export content
 * @param {Array} pngBlobs - Array of {name, blob} objects
 * @returns {Blob} - TAR archive as Blob
 */
export async function exportToTar(gridConfig, components, jsonContent, cssContent, pngBlobs) {
  const tar = new TarWriter();

  // Add images directory and all PNG files
  for (const png of pngBlobs) {
    const arrayBuffer = await png.blob.arrayBuffer();
    tar.addFile(`images/${png.name}.png`, arrayBuffer);
  }

  // Add JSON metadata
  tar.addFile('components.json', jsonContent);

  // Add CSS
  tar.addFile('components.css', cssContent);

  // Generate and add index.html
  const indexHtml = generateIndexHtml(components, gridConfig);
  tar.addFile('index.html', indexHtml);

  // Generate tar archive
  const tarballData = tar.generate();
  return new Blob([tarballData], { type: 'application/x-tar' });
}

/**
 * Generate interactive index.html showcasing all components
 */
function generateIndexHtml(components, gridConfig) {
  const nonEmptyComponents = components.filter(c => !c.isEmpty);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Component Gallery - ${gridConfig.columns}×${gridConfig.rows} Grid</title>
  <link rel="stylesheet" href="components.css">
  <style>
    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      padding: 20px;
      font-family: system-ui, -apple-system, sans-serif;
      background: #121212;
      color: #e0e0e0;
    }

    h1 {
      text-align: center;
      color: #4a9eff;
      margin-bottom: 10px;
    }

    .subtitle {
      text-align: center;
      color: #888;
      margin-bottom: 40px;
    }

    .component-list {
      max-width: 1200px;
      margin: 0 auto;
      display: flex;
      flex-direction: column;
      gap: 30px;
    }

    .component-item {
      background: #1a1a1a;
      border: 1px solid #333;
      border-radius: 8px;
      padding: 20px;
    }

    .component-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 15px;
      padding-bottom: 15px;
      border-bottom: 1px solid #333;
    }

    .component-title {
      font-size: 18px;
      font-weight: 500;
      color: #4a9eff;
    }

    .component-info {
      font-size: 13px;
      color: #888;
    }

    .component-actions {
      display: flex;
      gap: 10px;
    }

    .btn {
      padding: 8px 16px;
      background: #4a9eff;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 13px;
      transition: background 0.2s;
    }

    .btn:hover {
      background: #3a8eef;
    }

    .btn:active {
      background: #2a7edf;
    }

    .btn.success {
      background: #4caf50;
    }

    .component-preview {
      background: repeating-conic-gradient(#222 0% 25%, #181818 0% 50%) 50% / 20px 20px;
      padding: 20px;
      border-radius: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 150px;
    }

    .component-demo {
      display: inline-block;
      image-rendering: pixelated;
    }

    /* Resizable nine-slice components */
    .ninegrid-demo {
      resize: both;
      overflow: hidden;
      min-width: 100px;
      min-height: 50px;
      max-width: 600px;
      max-height: 400px;
      position: relative;
    }

    .ninegrid-demo::after {
      content: '⇲';
      position: absolute;
      bottom: 2px;
      right: 2px;
      color: rgba(255, 255, 255, 0.3);
      font-size: 12px;
      pointer-events: none;
    }

    .decal-demo {
      /* Fixed size for decals */
    }

    .component-meta {
      margin-top: 15px;
      padding-top: 15px;
      border-top: 1px solid #333;
      font-size: 12px;
      color: #888;
    }

    .component-meta-item {
      display: inline-block;
      margin-right: 20px;
      margin-bottom: 5px;
    }

    .component-meta-item strong {
      color: #aaa;
    }

    .toast {
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: #4caf50;
      color: white;
      padding: 12px 20px;
      border-radius: 4px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
      opacity: 0;
      transform: translateY(20px);
      transition: all 0.3s;
      pointer-events: none;
      z-index: 1000;
    }

    .toast.show {
      opacity: 1;
      transform: translateY(0);
    }
  </style>
</head>
<body>
  <h1>🎨 Component Gallery</h1>
  <p class="subtitle">Grid: ${gridConfig.columns}×${gridConfig.rows} | Components: ${nonEmptyComponents.length}</p>

  <div class="component-list">
${nonEmptyComponents.map(comp => generateComponentCard(comp)).join('\n')}
  </div>

  <div id="toast" class="toast"></div>

  <script>
    function copyHTML(button) {
      const encoded = button.getAttribute('data-html');
      const text = atob(encoded);
      copyToClipboard(text, button);
    }

    function copyCSS(button) {
      const encoded = button.getAttribute('data-css');
      const text = atob(encoded);
      copyToClipboard(text, button);
    }

    function copyToClipboard(text, button) {
      navigator.clipboard.writeText(text).then(() => {
        showToast('Copied to clipboard!');
        const originalText = button.textContent;
        button.textContent = '✓ Copied!';
        button.classList.add('success');
        setTimeout(() => {
          button.textContent = originalText;
          button.classList.remove('success');
        }, 2000);
      }).catch(err => {
        console.error('Failed to copy:', err);
        showToast('Failed to copy', 'error');
      });
    }

    function showToast(message, type = 'success') {
      const toast = document.getElementById('toast');
      toast.textContent = message;
      toast.className = 'toast show';
      if (type === 'error') {
        toast.style.background = '#f44336';
      } else {
        toast.style.background = '#4caf50';
      }
      setTimeout(() => {
        toast.classList.remove('show');
      }, 3000);
    }
  </script>
</body>
</html>`;
}

/**
 * Generate HTML card for a single component
 */
function generateComponentCard(comp) {
  const config = comp.config || {};
  const ninegrid = config.ninegrid || comp.nineSlice;
  const isNinegrid = ninegrid && (ninegrid.top > 0 || ninegrid.right > 0 || ninegrid.bottom > 0 || ninegrid.left > 0);
  const isDecal = config.decal?.enabled;
  const isImagemap = config.imagemap?.enabled;

  // Determine component type and demo class
  let componentType = 'Standard';
  let demoClass = 'component-demo';
  let demoStyle = '';

  if (isNinegrid) {
    componentType = 'Nine-Slice (Resizable)';
    demoClass = 'component-demo ninegrid-demo';
    demoStyle = `width: ${Math.max(comp.width, 150)}px; height: ${Math.max(comp.height, 100)}px;`;
  } else if (isDecal) {
    componentType = 'Decal (Fixed Size)';
    demoClass = 'component-demo decal-demo';
    demoStyle = `width: ${comp.width}px; height: ${comp.height}px;`;
  } else if (isImagemap) {
    componentType = 'Image Map';
  }

  // Generate CSS class name with ui- prefix
  let className = isDecal && config.decal.className
    ? config.decal.className
    : `ui-widget-${comp.row}-${comp.col}`;

  // Ensure ui- prefix for consistency
  if (!className.startsWith('ui-')) {
    className = 'ui-' + className;
  }

  // Generate HTML snippet
  const htmlSnippet = isImagemap && config.imagemap.areas
    ? `<img src="images/${comp.name}.png" usemap="#${config.imagemap.name}" alt="${comp.name}">
<map name="${config.imagemap.name}">
  ${config.imagemap.areas}
</map>`
    : `<div class="${className}"></div>`;

  // Generate CSS snippet with correct image paths
  let cssSnippet = '';
  if (isNinegrid) {
    cssSnippet = `.${className} {
  border-width: ${ninegrid.top}px ${ninegrid.right}px ${ninegrid.bottom}px ${ninegrid.left}px;
  border-style: solid;
  border-image-source: url('images/${comp.name}.png');
  border-image-slice: ${ninegrid.top} ${ninegrid.right} ${ninegrid.bottom} ${ninegrid.left};
  border-image-repeat: round;
  background-image: url('images/${comp.name}.png');
  background-size: cover;
}`;
  } else if (isDecal) {
    cssSnippet = `.${className} {
  width: ${comp.width}px;
  height: ${comp.height}px;
  background-image: url('images/${comp.name}.png');
  background-size: contain;
  background-repeat: ${config.decal.tile ? 'repeat' : 'no-repeat'};
  background-position: center;
}`;
  } else {
    cssSnippet = `.${className} {
  background-image: url('images/${comp.name}.png');
  background-size: contain;
  background-repeat: no-repeat;
}`;
  }

  // Escape for HTML attribute - encode as data attributes instead
  const htmlSnippetEncoded = btoa(htmlSnippet);
  const cssSnippetEncoded = btoa(cssSnippet);

  return `    <div class="component-item">
      <div class="component-header">
        <div>
          <div class="component-title">${comp.name}</div>
          <div class="component-info">
            Type: ${componentType} | Size: ${comp.width}×${comp.height}px
            ${isNinegrid ? ` | Slices: ${ninegrid.top}/${ninegrid.right}/${ninegrid.bottom}/${ninegrid.left}` : ''}
          </div>
        </div>
        <div class="component-actions">
          <button class="btn" data-html="${htmlSnippetEncoded}" onclick="copyHTML(this)">📋 Copy HTML</button>
          <button class="btn" data-css="${cssSnippetEncoded}" onclick="copyCSS(this)">🎨 Copy CSS</button>
        </div>
      </div>

      <div class="component-preview">
        <div class="${className}" style="${demoStyle}"></div>
      </div>

      <div class="component-meta">
        <div class="component-meta-item"><strong>Position:</strong> Row ${comp.row}, Col ${comp.col}</div>
        <div class="component-meta-item"><strong>Class:</strong> .${className}</div>
        <div class="component-meta-item"><strong>Image:</strong> images/${comp.name}.png</div>
        ${comp.shapes?.length ? `<div class="component-meta-item"><strong>Shapes:</strong> ${comp.shapes.length}</div>` : ''}
      </div>
    </div>`;
}
