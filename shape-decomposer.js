/**
 * Shape Decomposition Engine
 * Analyze extracted slices and detect geometric primitives:
 * horizontal lines, vertical lines, rectangles, and rounded rectangles.
 */

/**
 * Decompose an image slice into geometric primitives.
 *
 * @param {ImageData} imageData - Slice image data
 * @returns {ShapeAnalysis} - Detected shapes and their properties
 */
export function decomposeIntoShapes(imageData) {
  const { width, height, data } = imageData;

  // Find bounding box of non-transparent content
  const bounds = findContentBounds(imageData);
  if (!bounds) return { shapes: [], isEmpty: true, bounds: null };

  // Analyze the shape
  const shapes = [];

  // Check for rectangles first (including rounded)
  const roundedRects = detectRoundedRectangles(imageData, bounds);
  if (roundedRects.length > 0) {
    shapes.push(...roundedRects);
  } else {
    // Check for plain rectangles
    const rectangles = detectRectangles(imageData, bounds);
    shapes.push(...rectangles);
  }

  // Check for lines
  const horizontalLines = detectHorizontalLines(imageData, bounds);
  const verticalLines = detectVerticalLines(imageData, bounds);

  shapes.push(...horizontalLines, ...verticalLines);

  return {
    shapes,
    bounds,
    isEmpty: shapes.length === 0
  };
}

/**
 * Find the bounding box of non-transparent pixels.
 *
 * @param {ImageData} imageData - Image data
 * @returns {Object|null} - Bounds {x, y, width, height} or null if empty
 */
function findContentBounds(imageData) {
  const { width, height, data } = imageData;

  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const alpha = data[(y * width + x) * 4 + 3];
      if (alpha > 0) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }

  if (maxX < minX) return null;

  return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

/**
 * Detect horizontal lines in the image.
 *
 * @param {ImageData} imageData - Image data
 * @param {Object} bounds - Content bounds
 * @returns {Array} - Array of horizontal line objects
 */
function detectHorizontalLines(imageData, bounds) {
  const { width, data } = imageData;
  const lines = [];

  for (let y = bounds.y; y < bounds.y + bounds.height; y++) {
    let lineStart = null;
    let lineColor = null;

    for (let x = bounds.x; x <= bounds.x + bounds.width; x++) {
      const index = (y * width + x) * 4;
      const alpha = x < bounds.x + bounds.width ? data[index + 3] : 0;

      if (alpha > 0 && lineStart === null) {
        lineStart = x;
        lineColor = {
          r: data[index],
          g: data[index + 1],
          b: data[index + 2],
          a: data[index + 3]
        };
      } else if ((alpha === 0 || x === bounds.x + bounds.width) && lineStart !== null) {
        const lineLength = x - lineStart;

        // A horizontal line spans most of the width and is thin
        if (lineLength > bounds.width * 0.8) {
          lines.push({
            type: 'horizontal-line',
            x: lineStart,
            y: y,
            length: lineLength,
            thickness: 1,
            color: lineColor
          });
        }

        lineStart = null;
        lineColor = null;
      }
    }
  }

  return consolidateLines(lines, 'horizontal');
}

/**
 * Detect vertical lines in the image.
 *
 * @param {ImageData} imageData - Image data
 * @param {Object} bounds - Content bounds
 * @returns {Array} - Array of vertical line objects
 */
function detectVerticalLines(imageData, bounds) {
  const { width, data } = imageData;
  const lines = [];

  for (let x = bounds.x; x < bounds.x + bounds.width; x++) {
    let lineStart = null;
    let lineColor = null;

    for (let y = bounds.y; y <= bounds.y + bounds.height; y++) {
      const index = (y * width + x) * 4;
      const alpha = y < bounds.y + bounds.height ? data[index + 3] : 0;

      if (alpha > 0 && lineStart === null) {
        lineStart = y;
        lineColor = {
          r: data[index],
          g: data[index + 1],
          b: data[index + 2],
          a: data[index + 3]
        };
      } else if ((alpha === 0 || y === bounds.y + bounds.height) && lineStart !== null) {
        const lineLength = y - lineStart;

        if (lineLength > bounds.height * 0.8) {
          lines.push({
            type: 'vertical-line',
            x: x,
            y: lineStart,
            length: lineLength,
            thickness: 1,
            color: lineColor
          });
        }

        lineStart = null;
        lineColor = null;
      }
    }
  }

  return consolidateLines(lines, 'vertical');
}

/**
 * Consolidate adjacent lines.
 *
 * @param {Array} lines - Array of line objects
 * @param {string} type - 'horizontal' or 'vertical'
 * @returns {Array} - Consolidated lines
 */
function consolidateLines(lines, type) {
  // For simplicity, just return the lines as-is
  // Could be enhanced to merge adjacent lines
  return lines;
}

/**
 * Detect rectangles (filled regions with straight edges).
 *
 * @param {ImageData} imageData - Image data
 * @param {Object} bounds - Content bounds
 * @returns {Array} - Array of rectangle objects
 */
function detectRectangles(imageData, bounds) {
  const { width, data } = imageData;
  const rectangles = [];

  // Check if the entire bounds form a rectangle
  const isRectangle = checkIfRectangle(imageData, bounds);

  if (isRectangle) {
    // Sample dominant color
    const color = sampleDominantColor(imageData, bounds);

    rectangles.push({
      type: 'rectangle',
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      color: color,
      cornerRadius: 0
    });
  }

  return rectangles;
}

/**
 * Check if a bounded region forms a solid rectangle.
 *
 * @param {ImageData} imageData - Image data
 * @param {Object} bounds - Bounds {x, y, width, height}
 * @returns {boolean} - True if region is a rectangle
 */
function checkIfRectangle(imageData, bounds) {
  const { width, data } = imageData;
  let filledPixels = 0;
  let totalPixels = bounds.width * bounds.height;

  for (let y = bounds.y; y < bounds.y + bounds.height; y++) {
    for (let x = bounds.x; x < bounds.x + bounds.width; x++) {
      const alpha = data[(y * width + x) * 4 + 3];
      if (alpha > 200) filledPixels++;
    }
  }

  // If more than 95% filled, consider it a rectangle
  return filledPixels / totalPixels > 0.95;
}

/**
 * Sample the dominant color from a region.
 *
 * @param {ImageData} imageData - Image data
 * @param {Object} bounds - Bounds {x, y, width, height}
 * @returns {Object} - Color {r, g, b, a}
 */
function sampleDominantColor(imageData, bounds) {
  const { width, data } = imageData;

  // Sample center pixel
  const centerX = Math.floor(bounds.x + bounds.width / 2);
  const centerY = Math.floor(bounds.y + bounds.height / 2);
  const index = (centerY * width + centerX) * 4;

  return {
    r: data[index],
    g: data[index + 1],
    b: data[index + 2],
    a: data[index + 3]
  };
}

/**
 * Detect rounded rectangles by analyzing corner curvature.
 *
 * @param {ImageData} imageData - Image data
 * @param {Object} bounds - Content bounds
 * @returns {Array} - Array of rounded rectangle objects
 */
function detectRoundedRectangles(imageData, bounds) {
  const { width, data } = imageData;
  const roundedRects = [];

  // Analyze corners for curvature
  const corners = analyzeCorners(imageData, bounds);

  if (corners.hasRounding) {
    const color = sampleDominantColor(imageData, bounds);

    roundedRects.push({
      type: 'rounded-rectangle',
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      color: color,
      cornerRadius: corners.radius,
      corners: corners.individual
    });
  }

  return roundedRects;
}

/**
 * Analyze corners for rounding.
 *
 * @param {ImageData} imageData - Image data
 * @param {Object} bounds - Bounds {x, y, width, height}
 * @returns {Object} - Corner analysis results
 */
function analyzeCorners(imageData, bounds) {
  const { width, data } = imageData;

  // Sample corner regions
  const sampleSize = Math.min(20, Math.floor(Math.min(bounds.width, bounds.height) / 4));

  const cornerRegions = {
    topLeft: { x: bounds.x, y: bounds.y },
    topRight: { x: bounds.x + bounds.width - sampleSize, y: bounds.y },
    bottomLeft: { x: bounds.x, y: bounds.y + bounds.height - sampleSize },
    bottomRight: { x: bounds.x + bounds.width - sampleSize, y: bounds.y + bounds.height - sampleSize }
  };

  const cornerResults = {};
  let totalRadius = 0;
  let roundedCorners = 0;

  for (const [name, corner] of Object.entries(cornerRegions)) {
    const radius = measureCornerRadius(imageData, corner, sampleSize, name);
    cornerResults[name] = radius;

    if (radius > 0) {
      totalRadius += radius;
      roundedCorners++;
    }
  }

  return {
    hasRounding: roundedCorners > 0,
    radius: roundedCorners > 0 ? Math.round(totalRadius / roundedCorners) : 0,
    individual: cornerResults
  };
}

/**
 * Measure the radius of a single corner.
 *
 * @param {ImageData} imageData - Image data
 * @param {Object} corner - Corner position {x, y}
 * @param {number} sampleSize - Size of sample region
 * @param {string} cornerName - Name of corner
 * @returns {number} - Estimated corner radius
 */
function measureCornerRadius(imageData, corner, sampleSize, cornerName) {
  const { width, data } = imageData;

  // Determine which diagonal to analyze based on corner
  const diagonals = {
    topLeft: { dx: 1, dy: 1 },
    topRight: { dx: -1, dy: 1 },
    bottomLeft: { dx: 1, dy: -1 },
    bottomRight: { dx: -1, dy: -1 }
  };

  const { dx, dy } = diagonals[cornerName];
  const startX = dx === 1 ? corner.x : corner.x + sampleSize - 1;
  const startY = dy === 1 ? corner.y : corner.y + sampleSize - 1;

  // Walk along diagonal and find first non-transparent pixel
  for (let i = 0; i < sampleSize; i++) {
    const x = startX + dx * i;
    const y = startY + dy * i;
    const alpha = data[(y * width + x) * 4 + 3];

    if (alpha > 128) {
      // Found content - distance from corner is the radius
      return i;
    }
  }

  return 0; // No rounding detected
}
