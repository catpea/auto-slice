/**
 * Grid Detector Module
 * Automatically detect where slice lines exist in an image grid.
 */

// Default color difference tolerance for JPEG artifacts (0-255 per channel)
const DEFAULT_COLOR_TOLERANCE = 5;

/**
 * Get current tolerance setting from window.gridSettings or use default.
 *
 * @returns {number} - Current tolerance value
 */
function getTolerance() {
  return (typeof window !== 'undefined' && window.gridSettings?.tolerance !== undefined)
    ? window.gridSettings.tolerance
    : DEFAULT_COLOR_TOLERANCE;
}

/**
 * Detect grid configuration from an image.
 * Analyzes pixel rows and columns for consistent divider patterns.
 *
 * @param {ImageData} imageData - Canvas image data
 * @returns {GridConfig} - Detected grid configuration
 */
export function detectGrid(imageData) {
  const { width, height, data } = imageData;
  const tolerance = getTolerance();

  const horizontalLineGroups = findHorizontalDividers(data, width, height, tolerance);
  const verticalLineGroups = findVerticalDividers(data, width, height, tolerance);

  const horizontalSlices = horizontalLineGroups.map(g => g.center);
  const verticalSlices = verticalLineGroups.map(g => g.center);

  const cells = computeCells(horizontalSlices, verticalSlices, width, height);
  const gridLineSegments = computeGridLineSegments(horizontalLineGroups, verticalLineGroups, width, height);

  // Debug logging
  if (window.debug) {
    window.debug.log('Grid detection details', {
      imageSize: `${width}×${height}`,
      horizontalDividers: horizontalLineGroups.length,
      verticalDividers: verticalLineGroups.length,
      horizontalSlices: horizontalSlices,
      verticalSlices: verticalSlices,
      tolerance: tolerance
    });
  }

  return {
    rows: horizontalSlices.length + 1,
    columns: verticalSlices.length + 1,
    horizontalSlices: horizontalSlices,
    verticalSlices: verticalSlices,
    horizontalLineGroups: horizontalLineGroups,
    verticalLineGroups: verticalLineGroups,
    cells: cells,
    gridLineSegments: gridLineSegments
  };
}

/**
 * Find horizontal divider lines by analyzing row uniformity.
 * A divider is a row where all pixels share similar colors (within tolerance).
 *
 * @param {Uint8ClampedArray} data - Pixel data (RGBA)
 * @param {number} width - Image width
 * @param {number} height - Image height
 * @param {number} tolerance - Color tolerance
 * @returns {Array} - Array of line group objects {start, end, center}
 */
function findHorizontalDividers(data, width, height, tolerance) {
  const dividers = [];

  for (let y = 0; y < height; y++) {
    if (isUniformRow(data, width, height, y, tolerance)) {
      dividers.push(y);
    }
  }

  if (window.debug && dividers.length > 0) {
    window.debug.log(`Found ${dividers.length} uniform horizontal rows`);
  }

  return consolidateDividersToGroups(dividers);
}

/**
 * Find vertical divider lines by analyzing column uniformity.
 *
 * @param {Uint8ClampedArray} data - Pixel data (RGBA)
 * @param {number} width - Image width
 * @param {number} height - Image height
 * @param {number} tolerance - Color tolerance
 * @returns {Array} - Array of line group objects {start, end, center}
 */
function findVerticalDividers(data, width, height, tolerance) {
  const dividers = [];

  for (let x = 0; x < width; x++) {
    if (isUniformColumn(data, width, height, x, tolerance)) {
      dividers.push(x);
    }
  }

  if (window.debug && dividers.length > 0) {
    window.debug.log(`Found ${dividers.length} uniform vertical columns`);
  }

  return consolidateDividersToGroups(dividers);
}

/**
 * Check if a row has uniform color (potential divider).
 * Uses tolerance to handle JPEG compression artifacts.
 *
 * @param {Uint8ClampedArray} data - Pixel data
 * @param {number} width - Image width
 * @param {number} height - Image height
 * @param {number} y - Row index
 * @param {number} tolerance - Color tolerance
 * @returns {boolean} - True if row is uniform
 */
function isUniformRow(data, width, height, y, tolerance) {
  const startIndex = y * width * 4;
  const firstPixel = {
    r: data[startIndex],
    g: data[startIndex + 1],
    b: data[startIndex + 2],
    a: data[startIndex + 3]
  };

  for (let x = 1; x < width; x++) {
    const index = (y * width + x) * 4;

    // Check color difference with tolerance
    if (!colorsMatch(
      firstPixel.r, firstPixel.g, firstPixel.b, firstPixel.a,
      data[index], data[index + 1], data[index + 2], data[index + 3],
      tolerance
    )) {
      return false;
    }
  }

  return true;
}

/**
 * Check if a column has uniform color (potential divider).
 * Uses tolerance to handle JPEG compression artifacts.
 *
 * @param {Uint8ClampedArray} data - Pixel data
 * @param {number} width - Image width
 * @param {number} height - Image height
 * @param {number} x - Column index
 * @param {number} tolerance - Color tolerance
 * @returns {boolean} - True if column is uniform
 */
function isUniformColumn(data, width, height, x, tolerance) {
  const firstIndex = x * 4;
  const firstPixel = {
    r: data[firstIndex],
    g: data[firstIndex + 1],
    b: data[firstIndex + 2],
    a: data[firstIndex + 3]
  };

  for (let y = 1; y < height; y++) {
    const index = (y * width + x) * 4;

    // Check color difference with tolerance
    if (!colorsMatch(
      firstPixel.r, firstPixel.g, firstPixel.b, firstPixel.a,
      data[index], data[index + 1], data[index + 2], data[index + 3],
      tolerance
    )) {
      return false;
    }
  }

  return true;
}

/**
 * Check if two colors match within tolerance.
 *
 * @param {number} r1 - Red component 1
 * @param {number} g1 - Green component 1
 * @param {number} b1 - Blue component 1
 * @param {number} a1 - Alpha component 1
 * @param {number} r2 - Red component 2
 * @param {number} g2 - Green component 2
 * @param {number} b2 - Blue component 2
 * @param {number} a2 - Alpha component 2
 * @param {number} tolerance - Maximum difference per channel
 * @returns {boolean} - True if colors match within tolerance
 */
function colorsMatch(r1, g1, b1, a1, r2, g2, b2, a2, tolerance) {
  return Math.abs(r1 - r2) <= tolerance &&
         Math.abs(g1 - g2) <= tolerance &&
         Math.abs(b1 - b2) <= tolerance &&
         Math.abs(a1 - a2) <= tolerance;
}

/**
 * Consolidate consecutive divider lines into groups.
 * Multiple uniform rows/columns in sequence become one group with start, end, and center.
 *
 * @param {number[]} dividers - Array of divider coordinates
 * @returns {Array} - Array of group objects {start, end, center, width}
 */
function consolidateDividersToGroups(dividers) {
  if (dividers.length === 0) return [];

  const groups = [];
  let groupStart = dividers[0];
  let groupEnd = dividers[0];

  for (let i = 1; i < dividers.length; i++) {
    if (dividers[i] === groupEnd + 1) {
      groupEnd = dividers[i];
    } else {
      groups.push({
        start: groupStart,
        end: groupEnd,
        center: Math.floor((groupStart + groupEnd) / 2),
        width: groupEnd - groupStart + 1
      });
      groupStart = dividers[i];
      groupEnd = dividers[i];
    }
  }

  groups.push({
    start: groupStart,
    end: groupEnd,
    center: Math.floor((groupStart + groupEnd) / 2),
    width: groupEnd - groupStart + 1
  });

  return groups;
}

/**
 * Compute cell boundaries from slice lines.
 *
 * @param {number[]} horizontalLines - Y coordinates of horizontal slices
 * @param {number[]} verticalLines - X coordinates of vertical slices
 * @param {number} width - Image width
 * @param {number} height - Image height
 * @returns {Array} - Array of cell objects with x, y, width, height
 */
function computeCells(horizontalLines, verticalLines, width, height) {
  const cells = [];

  // Add boundaries (0 and max dimensions)
  const yBoundaries = [0, ...horizontalLines, height];
  const xBoundaries = [0, ...verticalLines, width];

  // Create cells from boundaries
  for (let row = 0; row < yBoundaries.length - 1; row++) {
    for (let col = 0; col < xBoundaries.length - 1; col++) {
      const y = yBoundaries[row];
      const nextY = yBoundaries[row + 1];
      const x = xBoundaries[col];
      const nextX = xBoundaries[col + 1];

      cells.push({
        type: 'cell',
        row: row,
        col: col,
        x: x,
        y: y,
        width: nextX - x,
        height: nextY - y
      });
    }
  }

  return cells;
}

/**
 * Compute grid line segments to be analyzed separately.
 *
 * @param {Array} horizontalLineGroups - Horizontal line groups
 * @param {Array} verticalLineGroups - Vertical line groups
 * @param {number} width - Image width
 * @param {number} height - Image height
 * @returns {Array} - Array of grid line segment objects
 */
function computeGridLineSegments(horizontalLineGroups, verticalLineGroups, width, height) {
  const segments = [];
  let segmentId = 0;

  // Horizontal line segments
  for (const lineGroup of horizontalLineGroups) {
    segments.push({
      id: `h-line-${segmentId++}`,
      type: 'horizontal-line',
      x: 0,
      y: lineGroup.start,
      width: width,
      height: lineGroup.width
    });
  }

  // Vertical line segments
  for (const lineGroup of verticalLineGroups) {
    segments.push({
      id: `v-line-${segmentId++}`,
      type: 'vertical-line',
      x: lineGroup.start,
      y: 0,
      width: lineGroup.width,
      height: height
    });
  }

  // Intersection segments (where horizontal and vertical lines cross)
  for (const hGroup of horizontalLineGroups) {
    for (const vGroup of verticalLineGroups) {
      segments.push({
        id: `intersection-${segmentId++}`,
        type: 'intersection',
        x: vGroup.start,
        y: hGroup.start,
        width: vGroup.width,
        height: hGroup.width
      });
    }
  }

  return segments;
}
