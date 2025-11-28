/**
 * Background Remover Module
 * Remove backgrounds and shadows exposed by slicing.
 * Clean up edge artifacts to produce pristine transparent PNGs.
 */

/**
 * Remove background color from an image region.
 * Uses flood-fill from corners to detect background.
 *
 * @param {ImageData} imageData - Source image data
 * @param {number} tolerance - Color matching tolerance (0-255)
 * @returns {ImageData} - Image with transparent background
 */
export function removeBackground(imageData, tolerance = 10) {
  const { width, height } = imageData;
  const result = new ImageData(
    new Uint8ClampedArray(imageData.data),
    width,
    height
  );

  // Sample background from corners
  const backgroundColors = sampleCorners(imageData);
  const dominantBackground = findDominantColor(backgroundColors);

  // Create mask of background pixels
  const mask = createBackgroundMask(result, dominantBackground, tolerance);

  // Apply mask (set background to transparent)
  applyTransparencyMask(result, mask);

  return result;
}

/**
 * Remove shadows along slice edges.
 * Shadows appear as gradients near cut lines.
 *
 * @param {ImageData} imageData - Image data
 * @param {number[]} sliceLines - Positions of slice lines
 * @param {number} shadowWidth - Expected shadow width in pixels
 * @returns {ImageData} - Image with shadows removed
 */
export function removeShadowsAlongSlices(imageData, sliceLines, shadowWidth = 3) {
  const { width, height, data } = imageData;

  for (const sliceLine of sliceLines) {
    // Analyze pixels near the slice line
    const startY = Math.max(0, sliceLine - shadowWidth);
    const endY = Math.min(height, sliceLine + shadowWidth);

    for (let y = startY; y < endY; y++) {
      for (let x = 0; x < width; x++) {
        const index = (y * width + x) * 4;

        // Check if pixel is semi-transparent (shadow indicator)
        if (data[index + 3] > 0 && data[index + 3] < 200) {
          // Determine if this is shadow based on neighboring pixels
          if (isShadowPixel(data, x, y, width, height)) {
            data[index + 3] = 0; // Make transparent
          }
        }
      }
    }
  }

  return imageData;
}

/**
 * Sample colors from image corners (likely background).
 *
 * @param {ImageData} imageData - Image data
 * @returns {Array} - Array of corner colors
 */
function sampleCorners(imageData) {
  const { width, height, data } = imageData;
  const corners = [
    { x: 0, y: 0 },
    { x: width - 1, y: 0 },
    { x: 0, y: height - 1 },
    { x: width - 1, y: height - 1 }
  ];

  return corners.map(({ x, y }) => {
    const index = (y * width + x) * 4;
    return {
      r: data[index],
      g: data[index + 1],
      b: data[index + 2],
      a: data[index + 3]
    };
  });
}

/**
 * Find the most common color among samples.
 *
 * @param {Array} colors - Array of color objects
 * @returns {Object} - Dominant color
 */
function findDominantColor(colors) {
  // Simple implementation: return first color
  // Could be enhanced to find actual dominant color
  return colors[0];
}

/**
 * Create a binary mask identifying background pixels.
 *
 * @param {ImageData} imageData - Image data
 * @param {Object} backgroundColor - Background color {r, g, b, a}
 * @param {number} tolerance - Color matching tolerance
 * @returns {Uint8Array} - Binary mask
 */
function createBackgroundMask(imageData, backgroundColor, tolerance) {
  const { width, height, data } = imageData;
  const mask = new Uint8Array(width * height);

  for (let i = 0; i < width * height; i++) {
    const index = i * 4;
    const distance = colorDistance(
      { r: data[index], g: data[index + 1], b: data[index + 2] },
      backgroundColor
    );

    mask[i] = distance <= tolerance ? 1 : 0;
  }

  // Flood fill from edges to ensure only connected background is removed
  return floodFillFromEdges(mask, width, height);
}

/**
 * Calculate Euclidean distance between two colors.
 *
 * @param {Object} color1 - First color {r, g, b}
 * @param {Object} color2 - Second color {r, g, b}
 * @returns {number} - Color distance
 */
function colorDistance(color1, color2) {
  const dr = color1.r - color2.r;
  const dg = color1.g - color2.g;
  const db = color1.b - color2.b;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

/**
 * Flood fill from image edges to find connected background.
 *
 * @param {Uint8Array} mask - Initial mask
 * @param {number} width - Image width
 * @param {number} height - Image height
 * @returns {Uint8Array} - Filled mask
 */
function floodFillFromEdges(mask, width, height) {
  const visited = new Uint8Array(width * height);
  const result = new Uint8Array(width * height);
  const queue = [];

  // Add edge pixels to queue
  for (let x = 0; x < width; x++) {
    queue.push(x); // Top edge
    queue.push((height - 1) * width + x); // Bottom edge
  }
  for (let y = 0; y < height; y++) {
    queue.push(y * width); // Left edge
    queue.push(y * width + width - 1); // Right edge
  }

  while (queue.length > 0) {
    const index = queue.shift();

    if (visited[index] || mask[index] === 0) continue;
    visited[index] = 1;
    result[index] = 1;

    const x = index % width;
    const y = Math.floor(index / width);

    // Add neighbors
    if (x > 0) queue.push(index - 1);
    if (x < width - 1) queue.push(index + 1);
    if (y > 0) queue.push(index - width);
    if (y < height - 1) queue.push(index + width);
  }

  return result;
}

/**
 * Apply transparency mask to image data.
 *
 * @param {ImageData} imageData - Image data to modify
 * @param {Uint8Array} mask - Binary mask
 */
function applyTransparencyMask(imageData, mask) {
  const { data } = imageData;

  for (let i = 0; i < mask.length; i++) {
    if (mask[i] === 1) {
      data[i * 4 + 3] = 0; // Set alpha to 0 (transparent)
    }
  }
}

/**
 * Determine if a pixel is likely a shadow artifact.
 *
 * @param {Uint8ClampedArray} data - Pixel data
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @param {number} width - Image width
 * @param {number} height - Image height
 * @returns {boolean} - True if pixel is likely a shadow
 */
function isShadowPixel(data, x, y, width, height) {
  const index = (y * width + x) * 4;
  const currentAlpha = data[index + 3];

  // Check if surrounded by transparent pixels
  let transparentNeighbors = 0;
  const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]];

  for (const [dx, dy] of directions) {
    const nx = x + dx;
    const ny = y + dy;

    if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
      const neighborIndex = (ny * width + nx) * 4;
      if (data[neighborIndex + 3] === 0) {
        transparentNeighbors++;
      }
    }
  }

  // If mostly surrounded by transparency and semi-transparent, likely shadow
  return transparentNeighbors >= 2 && currentAlpha < 128;
}
