/**
 * Image Grid Analyzer & Nine-Slice Decomposer
 * Main application entry point
 * No external dependencies - works entirely in browser for GitHub Pages
 */

import { detectGrid } from './grid-detector.js';
import { splitImage } from './image-splitter.js';
import { removeBackground, removeShadowsAlongSlices } from './background-remover.js';
import { decomposeIntoShapes } from './shape-decomposer.js';
import { exportToPNG } from './png-exporter.js';
import { exportToJSON } from './json-exporter.js';
import { exportToCSS } from './css-exporter.js';
import { createEditorView } from './editor-view.js';

/**
 * Main application class.
 */
class ImageGridAnalyzer {
  constructor(container) {
    this.container = container;
    this.sourceImage = null;
    this.gridConfig = null;
    this.components = [];
    this.gridLineComponents = [];
    this.editorView = null;
  }

  /**
   * Load an image for analysis.
   *
   * @param {File} file - Image file
   * @returns {Promise<HTMLImageElement>} - Loaded image
   */
  async loadImage(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          this.sourceImage = img;
          this.editorView = createEditorView(this.container, img);
          resolve(img);
        };
        img.onerror = reject;
        img.src = event.target.result;
      };

      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  /**
   * Analyze the loaded image.
   *
   * @returns {Object} - Analysis results {gridConfig, components, gridLineComponents}
   */
  analyze() {
    if (!this.sourceImage) {
      throw new Error('No image loaded');
    }

    // Get image data from canvas
    const canvas = document.createElement('canvas');
    canvas.width = this.sourceImage.width;
    canvas.height = this.sourceImage.height;

    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.sourceImage, 0, 0);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    // Step 1: Detect grid
    this.gridConfig = detectGrid(imageData);
    this.editorView.drawGridLines(this.gridConfig);

    // Step 2: Split image into grid lines and cells
    const splitData = splitImage(canvas, this.gridConfig);

    // Step 3: Process grid line segments
    this.gridLineComponents = [];
    for (const segment of splitData.gridLines) {
      const shapes = decomposeIntoShapes(segment.imageData);

      this.gridLineComponents.push({
        id: segment.id,
        name: segment.id,
        type: segment.type,
        sourceX: segment.x,
        sourceY: segment.y,
        width: segment.width,
        height: segment.height,
        imageData: segment.imageData,
        shapes: shapes.shapes,
        nineSlice: null // Grid lines typically don't use nine-slice
      });
    }

    // Step 4: Process cells
    this.components = [];
    for (const cell of splitData.cells) {
      // Remove background
      const cleanedData = removeBackground(cell.imageData);

      // Remove shadows along slice edges
      removeShadowsAlongSlices(cleanedData, [0, cell.height - 1], 3);

      // Decompose into shapes
      const shapes = decomposeIntoShapes(cleanedData);

      // Calculate nine-slice borders
      const nineSlice = calculateNineSliceBorders(cleanedData, shapes);

      this.components.push({
        id: cell.id,
        name: `widget-${cell.row}-${cell.col}`,
        type: cell.type,
        row: cell.row,
        col: cell.col,
        sourceX: cell.x,
        sourceY: cell.y,
        width: cell.width,
        height: cell.height,
        imageData: cleanedData,
        shapes: shapes.shapes,
        nineSlice: nineSlice
      });
    }

    return {
      gridConfig: this.gridConfig,
      components: this.components,
      gridLineComponents: this.gridLineComponents
    };
  }

  /**
   * Export all outputs.
   *
   * @returns {Promise<Object>} - Export results {pngBlobs, json, css}
   */
  async export() {
    // Combine grid lines and cells for export
    const allComponents = [...this.gridLineComponents, ...this.components];

    const pngBlobs = await exportToPNG(allComponents);
    const jsonOutput = exportToJSON(this.gridConfig, allComponents);
    const cssOutput = exportToCSS(this.components); // Only cells get CSS

    return {
      pngBlobs,
      json: jsonOutput,
      css: cssOutput
    };
  }
}

/**
 * Calculate nine-slice border widths from shape analysis.
 *
 * @param {ImageData} imageData - Image data
 * @param {Object} shapeAnalysis - Shape analysis results
 * @returns {Object|null} - Nine-slice borders {top, right, bottom, left}
 */
function calculateNineSliceBorders(imageData, shapeAnalysis) {
  const { width, height } = imageData;

  if (shapeAnalysis.isEmpty) {
    return null;
  }

  // Find the safe zone (stretchable area)
  const bounds = shapeAnalysis.bounds;

  // Default: use 1/4 of dimensions for borders
  const defaultBorder = Math.min(
    Math.floor(bounds.width / 4),
    Math.floor(bounds.height / 4),
    16
  );

  // Refine based on detected shapes
  let top = defaultBorder;
  let right = defaultBorder;
  let bottom = defaultBorder;
  let left = defaultBorder;

  // If we detected rounded corners, use the corner radius
  for (const shape of shapeAnalysis.shapes) {
    if (shape.type === 'rounded-rectangle' && shape.cornerRadius > 0) {
      const radius = shape.cornerRadius + 2; // Add padding
      top = Math.max(top, radius);
      right = Math.max(right, radius);
      bottom = Math.max(bottom, radius);
      left = Math.max(left, radius);
    }
  }

  return { top, right, bottom, left };
}

// Export for use
export { ImageGridAnalyzer };
