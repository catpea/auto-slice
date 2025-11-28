/**
 * Image Splitter Module
 * Extract grid line segments and cells from source image.
 * No external dependencies - works entirely in browser.
 */

/**
 * Split image into grid line segments and cells based on grid configuration.
 *
 * @param {HTMLCanvasElement} sourceCanvas - Source canvas with image
 * @param {GridConfig} gridConfig - Grid configuration from detector
 * @returns {Object} - Split image data {gridLines, cells}
 */
export function splitImage(sourceCanvas, gridConfig) {
  const ctx = sourceCanvas.getContext('2d');
  const allSegments = [];

  // Extract grid line segments
  for (const segment of gridConfig.gridLineSegments) {
    const imageData = ctx.getImageData(segment.x, segment.y, segment.width, segment.height);

    allSegments.push({
      id: segment.id,
      type: segment.type,
      x: segment.x,
      y: segment.y,
      width: segment.width,
      height: segment.height,
      imageData: imageData
    });
  }

  // Extract cells
  for (const cell of gridConfig.cells) {
    const imageData = ctx.getImageData(cell.x, cell.y, cell.width, cell.height);

    allSegments.push({
      id: `cell-${cell.row}-${cell.col}`,
      type: cell.type,
      row: cell.row,
      col: cell.col,
      x: cell.x,
      y: cell.y,
      width: cell.width,
      height: cell.height,
      imageData: imageData
    });
  }

  return {
    gridLines: allSegments.filter(s => s.type !== 'cell'),
    cells: allSegments.filter(s => s.type === 'cell'),
    allSegments: allSegments
  };
}

/**
 * Extract a specific region from the canvas.
 *
 * @param {HTMLCanvasElement} sourceCanvas - Source canvas
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @param {number} width - Width
 * @param {number} height - Height
 * @returns {ImageData} - Extracted image data
 */
export function extractRegion(sourceCanvas, x, y, width, height) {
  const ctx = sourceCanvas.getContext('2d');
  return ctx.getImageData(x, y, width, height);
}
