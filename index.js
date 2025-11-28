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

          // Debug logging
          if (window.debug) {
            window.debug.log('Image loaded', {
              width: img.width,
              height: img.height,
              filename: file.name
            });
          }

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

    // Notify debug server
    if (window.debug) {
      window.debug.send('analysis-start', {});
    }

    const startTime = performance.now();

    // Get image data from canvas
    const canvas = document.createElement('canvas');
    canvas.width = this.sourceImage.width;
    canvas.height = this.sourceImage.height;

    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.sourceImage, 0, 0);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    // Step 1: Detect grid
    const gridStartTime = performance.now();
    this.gridConfig = detectGrid(imageData);
    const gridDuration = performance.now() - gridStartTime;

    if (window.debug) {
      window.debug.send('grid-detected', { data: this.gridConfig });
      window.debug.send('performance', {
        operation: 'Grid Detection',
        duration: Math.round(gridDuration)
      });
    }

    this.editorView.drawGridLines(this.gridConfig);

    // Step 2: Split image into grid lines and cells
    const splitStartTime = performance.now();
    const splitData = splitImage(canvas, this.gridConfig);
    const splitDuration = performance.now() - splitStartTime;

    if (window.debug) {
      window.debug.send('performance', {
        operation: 'Image Splitting',
        duration: Math.round(splitDuration)
      });
    }

    // Step 3: Process grid line segments
    const lineProcessStartTime = performance.now();
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
    const lineProcessDuration = performance.now() - lineProcessStartTime;

    if (window.debug) {
      window.debug.send('performance', {
        operation: 'Grid Line Processing',
        duration: Math.round(lineProcessDuration)
      });
    }

    // Step 4: Process cells
    const cellProcessStartTime = performance.now();
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
    const cellProcessDuration = performance.now() - cellProcessStartTime;

    if (window.debug) {
      window.debug.send('performance', {
        operation: 'Cell Processing',
        duration: Math.round(cellProcessDuration)
      });
    }

    const totalDuration = performance.now() - startTime;

    // Count total shapes
    const totalShapes = [...this.gridLineComponents, ...this.components]
      .reduce((sum, comp) => sum + comp.shapes.length, 0);

    const results = {
      gridConfig: this.gridConfig,
      components: this.components,
      gridLineComponents: this.gridLineComponents
    };

    // Send complete analysis to debug server
    if (window.debug) {
      window.debug.send('analysis-complete', {
        data: {
          gridConfig: {
            rows: this.gridConfig.rows,
            columns: this.gridConfig.columns,
            horizontalSlices: this.gridConfig.horizontalSlices.length,
            verticalSlices: this.gridConfig.verticalSlices.length
          },
          gridLineComponents: this.gridLineComponents.map(c => ({
            id: c.id,
            type: c.type,
            width: c.width,
            height: c.height,
            shapes: c.shapes.map(s => ({ type: s.type }))
          })),
          components: this.components.map(c => ({
            id: c.id,
            name: c.name,
            width: c.width,
            height: c.height,
            shapes: c.shapes.map(s => ({ type: s.type })),
            nineSlice: c.nineSlice
          })),
          totalShapes: totalShapes
        }
      });
      window.debug.send('performance', {
        operation: 'Total Analysis',
        duration: Math.round(totalDuration)
      });
    }

    return results;
  }

  /**
   * Export all outputs.
   *
   * @returns {Promise<Object>} - Export results {pngBlobs, json, css}
   */
  async export() {
    if (window.debug) {
      window.debug.log('Starting export...');
    }

    const startTime = performance.now();

    // Combine grid lines and cells for export
    const allComponents = [...this.gridLineComponents, ...this.components];

    const pngBlobs = await exportToPNG(allComponents);
    const jsonOutput = exportToJSON(this.gridConfig, allComponents);
    const cssOutput = exportToCSS(this.components); // Only cells get CSS

    const duration = performance.now() - startTime;

    if (window.debug) {
      window.debug.send('performance', {
        operation: 'Export',
        duration: Math.round(duration)
      });
      window.debug.log('Export complete', {
        pngCount: pngBlobs.length,
        jsonSize: jsonOutput.length,
        cssSize: cssOutput.length
      });
    }

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
