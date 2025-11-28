/**
 * Editor View Module
 * Use custom pan-zoom for navigating large source images during analysis.
 * No external dependencies - works entirely in browser.
 */

import { PanZoom } from './pan-zoom.js';

/**
 * Create an interactive editor view for image analysis.
 *
 * @param {HTMLElement} container - Container element
 * @param {HTMLImageElement} sourceImage - Source image
 * @returns {Object} - Editor view interface
 */
export function createEditorView(container, sourceImage) {
  // Clear container
  container.innerHTML = '';

  // Create pan-zoom container
  const panZoomContainer = document.createElement('div');
  panZoomContainer.className = 'pan-zoom-container';
  panZoomContainer.style.cssText = `
    width: 100%;
    height: 600px;
    background: #1a1a1a;
    overflow: hidden;
    position: relative;
    user-select: none;
  `;

  // Create content wrapper
  const content = document.createElement('div');
  content.className = 'pan-zoom-content';
  content.style.cssText = `
    transform-origin: 0 0;
    position: relative;
    display: inline-block;
  `;

  // Create canvas for image display
  const canvas = document.createElement('canvas');
  canvas.width = sourceImage.width;
  canvas.height = sourceImage.height;
  canvas.style.cssText = `
    display: block;
    image-rendering: pixelated;
    image-rendering: crisp-edges;
  `;

  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(sourceImage, 0, 0);

  // Add overlay canvas for drawing slice lines
  const overlay = document.createElement('canvas');
  overlay.width = sourceImage.width;
  overlay.height = sourceImage.height;
  overlay.style.cssText = `
    position: absolute;
    top: 0;
    left: 0;
    pointer-events: none;
  `;

  // Assemble
  content.appendChild(canvas);
  content.appendChild(overlay);
  panZoomContainer.appendChild(content);
  container.appendChild(panZoomContainer);

  // Create controls
  const controls = document.createElement('div');
  controls.className = 'pan-zoom-controls';
  controls.style.cssText = `
    position: absolute;
    top: 10px;
    right: 10px;
    display: flex;
    flex-direction: column;
    gap: 5px;
    z-index: 10;
  `;

  const buttonStyle = `
    width: 32px;
    height: 32px;
    background: rgba(74, 158, 255, 0.9);
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 18px;
    display: flex;
    align-items: center;
    justify-content: center;
  `;

  const zoomInBtn = document.createElement('button');
  zoomInBtn.textContent = '+';
  zoomInBtn.style.cssText = buttonStyle;
  zoomInBtn.title = 'Zoom In';

  const zoomOutBtn = document.createElement('button');
  zoomOutBtn.textContent = '−';
  zoomOutBtn.style.cssText = buttonStyle;
  zoomOutBtn.title = 'Zoom Out';

  const resetBtn = document.createElement('button');
  resetBtn.textContent = '⟲';
  resetBtn.style.cssText = buttonStyle;
  resetBtn.title = 'Reset View';

  const fitBtn = document.createElement('button');
  fitBtn.textContent = '⛶';
  fitBtn.style.cssText = buttonStyle;
  fitBtn.title = 'Fit to View';

  controls.appendChild(zoomInBtn);
  controls.appendChild(zoomOutBtn);
  controls.appendChild(resetBtn);
  controls.appendChild(fitBtn);
  panZoomContainer.appendChild(controls);

  // Initialize pan-zoom
  const panZoom = new PanZoom(panZoomContainer);

  // Wire up controls
  zoomInBtn.addEventListener('click', () => panZoom.zoomIn());
  zoomOutBtn.addEventListener('click', () => panZoom.zoomOut());
  resetBtn.addEventListener('click', () => panZoom.reset());
  fitBtn.addEventListener('click', () => panZoom.fitToView());

  // Fit to view initially
  setTimeout(() => panZoom.fitToView(), 100);

  return {
    panZoom,
    canvas,
    overlay,
    ctx,
    overlayCtx: overlay.getContext('2d'),

    /**
     * Draw detected grid lines on overlay.
     *
     * @param {GridConfig} gridConfig - Grid configuration
     */
    drawGridLines(gridConfig) {
      const overlayCtx = overlay.getContext('2d');
      overlayCtx.clearRect(0, 0, overlay.width, overlay.height);

      // Draw horizontal slice lines
      overlayCtx.strokeStyle = 'rgba(255, 0, 0, 0.7)';
      overlayCtx.lineWidth = 2;

      for (const y of gridConfig.horizontalSlices) {
        overlayCtx.beginPath();
        overlayCtx.moveTo(0, y + 0.5);
        overlayCtx.lineTo(overlay.width, y + 0.5);
        overlayCtx.stroke();
      }

      // Draw vertical slice lines
      overlayCtx.strokeStyle = 'rgba(0, 255, 0, 0.7)';

      for (const x of gridConfig.verticalSlices) {
        overlayCtx.beginPath();
        overlayCtx.moveTo(x + 0.5, 0);
        overlayCtx.lineTo(x + 0.5, overlay.height);
        overlayCtx.stroke();
      }
    },

    /**
     * Highlight a specific cell.
     *
     * @param {Object} cell - Cell object {x, y, width, height}
     * @param {string} color - Highlight color (rgba string)
     */
    highlightCell(cell, color = 'rgba(255, 255, 0, 0.3)') {
      const overlayCtx = overlay.getContext('2d');
      overlayCtx.fillStyle = color;
      overlayCtx.fillRect(cell.x, cell.y, cell.width, cell.height);
    }
  };
}
