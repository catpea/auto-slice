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
 * Get minimum gap settings from window.gridSettings or use defaults.
 *
 * @returns {Object} - {minXGap, minYGap}
 */
function getMinGaps() {
  return {
    minXGap: (typeof window !== 'undefined' && window.gridSettings?.minXGap !== undefined)
      ? window.gridSettings.minXGap
      : 50,
    minYGap: (typeof window !== 'undefined' && window.gridSettings?.minYGap !== undefined)
      ? window.gridSettings.minYGap
      : 50
  };
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
  const { minXGap, minYGap } = getMinGaps();

  // Detect outer borders (frame around the entire image)
  const outerBorders = detectOuterBorders(data, width, height, tolerance);

  const horizontalLineGroups = findHorizontalDividers(data, width, height, tolerance);
  const verticalLineGroups = findVerticalDividers(data, width, height, tolerance);

  // Refine centers to be perfectly aligned
  const refinedHorizontalGroups = refineDividerCenters(horizontalLineGroups);
  const refinedVerticalGroups = refineDividerCenters(verticalLineGroups);

  // Apply minimum gap filtering
  const filteredHorizontalGroups = enforceMinimumGap(refinedHorizontalGroups, minYGap);
  const filteredVerticalGroups = enforceMinimumGap(refinedVerticalGroups, minXGap);

  const horizontalSlices = filteredHorizontalGroups.map(g => g.center);
  const verticalSlices = filteredVerticalGroups.map(g => g.center);

  const cells = computeCells(horizontalSlices, verticalSlices, width, height, outerBorders);
  const gridLineSegments = computeGridLineSegments(filteredHorizontalGroups, filteredVerticalGroups, width, height);

  // Debug logging
  if (window.debug) {
    window.debug.log('Grid detection details', {
      imageSize: `${width}×${height}`,
      outerBorders: outerBorders,
      horizontalDividersRaw: horizontalLineGroups.length,
      horizontalDividersFiltered: filteredHorizontalGroups.length,
      verticalDividersRaw: verticalLineGroups.length,
      verticalDividersFiltered: filteredVerticalGroups.length,
      horizontalSlices: horizontalSlices,
      verticalSlices: verticalSlices,
      tolerance: tolerance,
      minXGap: minXGap,
      minYGap: minYGap
    });
  }

  return {
    // Cells are only created BETWEEN gridlines
    // columns (X) = gaps between vertical lines
    // rows (Y) = gaps between horizontal lines
    columns: verticalSlices.length > 0 ? verticalSlices.length - 1 : 1,
    rows: horizontalSlices.length > 0 ? horizontalSlices.length - 1 : 1,
    horizontalSlices: horizontalSlices,
    verticalSlices: verticalSlices,
    horizontalLineGroups: filteredHorizontalGroups,
    verticalLineGroups: filteredVerticalGroups,
    cells: cells,
    gridLineSegments: gridLineSegments,
    outerBorders: outerBorders
  };
}

/**
 * Detect outer borders (frame) around the entire image.
 * These are uniform edges that should be excluded from cell content.
 *
 * @param {Uint8ClampedArray} data - Pixel data (RGBA)
 * @param {number} width - Image width
 * @param {number} height - Image height
 * @param {number} tolerance - Color tolerance
 * @returns {Object} - {top, right, bottom, left} border widths in pixels
 */
function detectOuterBorders(data, width, height, tolerance) {
  const borders = { top: 0, right: 0, bottom: 0, left: 0 };

  // Detect top border
  for (let y = 0; y < height; y++) {
    if (isUniformRow(data, width, height, y, tolerance)) {
      borders.top = y + 1;
    } else {
      break;
    }
  }

  // Detect bottom border
  for (let y = height - 1; y >= 0; y--) {
    if (isUniformRow(data, width, height, y, tolerance)) {
      borders.bottom = height - y;
    } else {
      break;
    }
  }

  // Detect left border
  for (let x = 0; x < width; x++) {
    if (isUniformColumn(data, width, height, x, tolerance)) {
      borders.left = x + 1;
    } else {
      break;
    }
  }

  // Detect right border
  for (let x = width - 1; x >= 0; x--) {
    if (isUniformColumn(data, width, height, x, tolerance)) {
      borders.right = width - x;
    } else {
      break;
    }
  }

  return borders;
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
 * Center is calculated as the true midpoint for proper alignment.
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
      // Use precise center calculation (including fractional pixels)
      const preciseCenter = (groupStart + groupEnd) / 2;
      groups.push({
        start: groupStart,
        end: groupEnd,
        center: Math.round(preciseCenter), // Round to nearest pixel for consistent centering
        width: groupEnd - groupStart + 1
      });
      groupStart = dividers[i];
      groupEnd = dividers[i];
    }
  }

  // Add final group
  const preciseCenter = (groupStart + groupEnd) / 2;
  groups.push({
    start: groupStart,
    end: groupEnd,
    center: Math.round(preciseCenter),
    width: groupEnd - groupStart + 1
  });

  return groups;
}

/**
 * Refine divider centers for perfect alignment.
 * Ensures the center is the true geometric midpoint of the divider.
 *
 * @param {Array} lineGroups - Array of line group objects
 * @returns {Array} - Line groups with refined centers
 */
function refineDividerCenters(lineGroups) {
  return lineGroups.map(group => {
    // For even-width dividers, ensure consistent rounding
    // For odd-width dividers, center is naturally at a pixel
    const exactCenter = (group.start + group.end) / 2;

    return {
      ...group,
      center: Math.round(exactCenter),
      exactCenter: exactCenter // Keep precise value for debugging
    };
  });
}

/**
 * Enforce minimum gap between detected grid lines.
 * When lines are too close together, keep the thickest/most prominent one.
 *
 * @param {Array} lineGroups - Array of line group objects
 * @param {number} minGap - Minimum gap in pixels
 * @returns {Array} - Filtered line groups
 */
function enforceMinimumGap(lineGroups, minGap) {
  if (lineGroups.length === 0) return [];

  const filtered = [];
  let lastKept = null;

  for (let i = 0; i < lineGroups.length; i++) {
    const current = lineGroups[i];

    // First line always gets added
    if (lastKept === null) {
      filtered.push(current);
      lastKept = current;
      continue;
    }

    // Check distance from last kept line
    const distance = current.center - lastKept.center;

    if (distance >= minGap) {
      // Far enough - keep this line
      filtered.push(current);
      lastKept = current;
    } else {
      // Too close - compare which one is better
      // Prefer thicker lines (more uniform pixels)
      if (current.width > lastKept.width) {
        // Replace the last kept line with this one
        filtered[filtered.length - 1] = current;
        lastKept = current;
      }
      // Otherwise, skip this line (keep the previous one)
    }
  }

  if (window.debug && lineGroups.length !== filtered.length) {
    window.debug.log(`Filtered out ${lineGroups.length - filtered.length} duplicate lines (minGap: ${minGap}px)`);
  }

  return filtered;
}

/**
 * Compute cell boundaries from slice lines.
 * Cells are ONLY created between gridlines, not in border areas.
 * Areas before the first gridline and after the last gridline are trimmed off.
 *
 * @param {number[]} horizontalLines - Y coordinates of horizontal slices
 * @param {number[]} verticalLines - X coordinates of vertical slices
 * @param {number} width - Image width
 * @param {number} height - Image height
 * @param {Object} outerBorders - Detected outer border widths (not used for cell boundaries)
 * @returns {Array} - Array of cell objects with x, y, width, height
 */
function computeCells(horizontalLines, verticalLines, width, height, outerBorders) {
  const cells = [];

  // IMPORTANT: Cells are ONLY created BETWEEN gridlines
  // The areas from image edge to first gridline and from last gridline to image edge
  // are border areas that should be trimmed off, not treated as widgets

  // If we have no gridlines, there's only one big cell (the entire content area)
  if (horizontalLines.length === 0 && verticalLines.length === 0) {
    cells.push({
      type: 'cell',
      row: 0,
      col: 0,
      x: 0,
      y: 0,
      width: width,
      height: height
    });
    return cells;
  }

  // Use gridlines as boundaries
  const yBoundaries = horizontalLines;
  const xBoundaries = verticalLines;

  // Create cells between gridlines only
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
