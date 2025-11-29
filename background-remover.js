/**
 * Background Remover Module
 * Remove backgrounds and shadows exposed by slicing.
 * Clean up edge artifacts to produce pristine transparent PNGs.
 */

/**
 * Get current background removal aggressiveness from settings.
 *
 * @returns {number} - Background removal value (0-100)
 */
function getBackgroundRemovalSetting() {
  return (typeof window !== 'undefined' && window.gridSettings?.backgroundRemoval !== undefined)
    ? window.gridSettings.backgroundRemoval
    : 30;
}

/**
 * Remove background color from an image region.
 * Uses flood-fill from corners to detect background.
 * Applies aggressive shadow removal based on settings.
 *
 * @param {ImageData} imageData - Source image data
 * @param {number} tolerance - Color matching tolerance (0-255) - deprecated, uses settings
 * @returns {ImageData} - Image with transparent background
 */
export function removeBackground(imageData, tolerance = 10) {
  const { width, height } = imageData;
  const result = new ImageData(
    new Uint8ClampedArray(imageData.data),
    width,
    height
  );

  // Use background removal setting (0-100 scale)
  const aggressiveness = getBackgroundRemovalSetting();
  const effectiveTolerance = Math.max(tolerance, aggressiveness * 2); // Scale to 0-200 range

  // Sample background from corners to avoid shadow contamination and widget content
  const backgroundColors = sampleBackgroundPoints(imageData);
  const dominantBackground = findMostCommonColor(backgroundColors);

  if (window.debug) {
    window.debug.log('Background detection', {
      imageSize: `${width}×${height}`,
      sampledColors: backgroundColors.length,
      detectedBackground: `rgba(${dominantBackground.r}, ${dominantBackground.g}, ${dominantBackground.b}, ${dominantBackground.a})`,
      tolerance: effectiveTolerance,
      aggressiveness: aggressiveness,
      allSamples: backgroundColors.map(c => `rgba(${c.r},${c.g},${c.b},${c.a})`).join(', ')
    });
  }

  // Create mask of background pixels
  const mask = createBackgroundMask(result, dominantBackground, effectiveTolerance);

  // Count background pixels for debugging
  if (window.debug) {
    let bgPixelCount = 0;
    for (let i = 0; i < mask.length; i++) {
      if (mask[i] === 1) bgPixelCount++;
    }
    const totalPixels = width * height;
    const bgPercent = ((bgPixelCount / totalPixels) * 100).toFixed(1);
    window.debug.log('Background mask', {
      backgroundPixels: bgPixelCount,
      totalPixels: totalPixels,
      backgroundPercent: `${bgPercent}%`
    });
  }

  // Apply mask (set background to transparent)
  applyTransparencyMask(result, mask);

  // Debug: count remaining opaque pixels after background removal
  if (window.debug) {
    let opaquePixels = 0;
    for (let i = 0; i < width * height; i++) {
      if (result.data[i * 4 + 3] > 0) opaquePixels++;
    }
    const totalPixels = width * height;
    const contentPercent = ((opaquePixels / totalPixels) * 100).toFixed(1);
    window.debug.log('After background mask', {
      opaquePixels: opaquePixels,
      totalPixels: totalPixels,
      contentPercent: `${contentPercent}%`
    });
  }

  // ALWAYS remove gradient shadows - adjust intensity based on aggressiveness
  // Even at low settings, we need to remove obvious drop shadows
  const shadowAggressiveness = Math.max(aggressiveness, 25);
  removeGradientShadows(result, shadowAggressiveness);

  // Remove semi-transparent pixels (shadow artifacts)
  // Always be reasonably aggressive with semi-transparent pixels to avoid shadow remnants
  const semiTransparentAggressiveness = Math.max(aggressiveness, 30);
  removeSemiTransparentPixels(result, semiTransparentAggressiveness);

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
 * Sample colors from multiple edge points to identify background.
 * Samples from actual corners AND a few pixels inward to avoid widget content.
 *
 * @param {ImageData} imageData - Image data
 * @returns {Array} - Array of sampled colors
 */
function sampleBackgroundPoints(imageData) {
  const { width, height, data } = imageData;
  const samples = [];

  // Sample from the 4 corners - these are most likely to be background
  const cornerPoints = [
    { x: 0, y: 0 },                     // Top-left corner
    { x: width - 1, y: 0 },             // Top-right corner
    { x: 0, y: height - 1 },            // Bottom-left corner
    { x: width - 1, y: height - 1 }     // Bottom-right corner
  ];

  // Also sample a few pixels inward from corners to get more samples
  // but avoid sampling from the center where widget content is likely
  const inset = Math.min(3, Math.floor(Math.min(width, height) / 4));
  if (width > inset * 2 && height > inset * 2) {
    cornerPoints.push(
      { x: inset, y: inset },                       // Top-left inset
      { x: width - 1 - inset, y: inset },           // Top-right inset
      { x: inset, y: height - 1 - inset },          // Bottom-left inset
      { x: width - 1 - inset, y: height - 1 - inset } // Bottom-right inset
    );
  }

  for (const { x, y } of cornerPoints) {
    const index = (y * width + x) * 4;
    samples.push({
      r: data[index],
      g: data[index + 1],
      b: data[index + 2],
      a: data[index + 3]
    });
  }

  return samples;
}

/**
 * Find the most common color among samples using color clustering.
 *
 * @param {Array} colors - Array of color objects
 * @returns {Object} - Most common color
 */
function findMostCommonColor(colors) {
  if (colors.length === 0) return { r: 255, g: 255, b: 255, a: 255 };

  // Group similar colors (within tolerance of 20)
  const colorGroups = [];
  const tolerance = 20;

  for (const color of colors) {
    let foundGroup = false;

    for (const group of colorGroups) {
      const groupColor = group[0];
      const distance = Math.sqrt(
        Math.pow(color.r - groupColor.r, 2) +
        Math.pow(color.g - groupColor.g, 2) +
        Math.pow(color.b - groupColor.b, 2)
      );

      if (distance <= tolerance) {
        group.push(color);
        foundGroup = true;
        break;
      }
    }

    if (!foundGroup) {
      colorGroups.push([color]);
    }
  }

  // Find largest group
  let largestGroup = colorGroups[0];
  for (const group of colorGroups) {
    if (group.length > largestGroup.length) {
      largestGroup = group;
    }
  }

  // Return average color of largest group
  const avgColor = {
    r: 0, g: 0, b: 0, a: 0
  };

  for (const color of largestGroup) {
    avgColor.r += color.r;
    avgColor.g += color.g;
    avgColor.b += color.b;
    avgColor.a += color.a;
  }

  avgColor.r = Math.round(avgColor.r / largestGroup.length);
  avgColor.g = Math.round(avgColor.g / largestGroup.length);
  avgColor.b = Math.round(avgColor.b / largestGroup.length);
  avgColor.a = Math.round(avgColor.a / largestGroup.length);

  return avgColor;
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

/**
 * Remove gradient shadows by detecting massive color changes.
 * Shadows typically appear as gradual color transitions near edges.
 *
 * @param {ImageData} imageData - Image data
 * @param {number} aggressiveness - How aggressive to be (0-100)
 */
function removeGradientShadows(imageData, aggressiveness) {
  const { width, height, data } = imageData;
  // Minimum 3 pixels depth even at low settings to catch drop shadows
  const scanDepth = Math.max(3, Math.min(15, Math.floor(aggressiveness / 6)));

  // Scan from all four edges inward
  for (let depth = 0; depth < scanDepth; depth++) {
    // Top and bottom edges
    for (let x = 0; x < width; x++) {
      checkAndRemoveGradient(data, x, depth, width, height, aggressiveness);
      checkAndRemoveGradient(data, x, height - 1 - depth, width, height, aggressiveness);
    }

    // Left and right edges
    for (let y = 0; y < height; y++) {
      checkAndRemoveGradient(data, depth, y, width, height, aggressiveness);
      checkAndRemoveGradient(data, width - 1 - depth, y, width, height, aggressiveness);
    }
  }
}

/**
 * Check if a pixel is part of a gradient shadow and remove it.
 *
 * @param {Uint8ClampedArray} data - Pixel data
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @param {number} width - Image width
 * @param {number} height - Image height
 * @param {number} aggressiveness - How aggressive to be (0-100)
 */
function checkAndRemoveGradient(data, x, y, width, height, aggressiveness) {
  if (x < 0 || x >= width || y < 0 || y >= height) return;

  const index = (y * width + x) * 4;
  const alpha = data[index + 3];

  // If already transparent, skip
  if (alpha === 0) return;

  // Check for semi-transparent pixels (common in shadows)
  if (alpha < 250) {
    // Semi-transparent pixels near edges are almost always shadows
    data[index + 3] = 0;
    return;
  }

  // Check for low saturation (typical of shadows)
  const r = data[index];
  const g = data[index + 1];
  const b = data[index + 2];

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const saturation = max === 0 ? 0 : (max - min) / max;
  const brightness = (r + g + b) / 3;

  // Detect shadows: low saturation + low/medium brightness
  const saturationThreshold = 0.3 - (aggressiveness / 500);
  const isShadowLike = saturation < saturationThreshold && brightness < 200;

  if (isShadowLike) {
    // Check if there's solid content nearby
    const hasStrongNeighbor = checkForStrongNeighbor(data, x, y, width, height);
    if (!hasStrongNeighbor) {
      data[index + 3] = 0; // Make transparent
    }
  }
}

/**
 * Check if a pixel has a strong (high saturation/alpha) neighbor.
 *
 * @param {Uint8ClampedArray} data - Pixel data
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @param {number} width - Image width
 * @param {number} height - Image height
 * @returns {boolean} - True if has strong neighbor
 */
function checkForStrongNeighbor(data, x, y, width, height) {
  const directions = [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, 1], [-1, 1], [1, -1]];

  for (const [dx, dy] of directions) {
    const nx = x + dx;
    const ny = y + dy;

    if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
      const neighborIndex = (ny * width + nx) * 4;
      const alpha = data[neighborIndex + 3];

      // Strong neighbor = fully opaque pixels
      if (alpha === 255) {
        const r = data[neighborIndex];
        const g = data[neighborIndex + 1];
        const b = data[neighborIndex + 2];

        // Calculate saturation and brightness
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const saturation = max === 0 ? 0 : (max - min) / max;
        const brightness = (r + g + b) / 3;

        // Solid content has either high saturation OR high brightness
        if (saturation > 0.3 || brightness > 150) {
          return true; // Found solid widget content
        }
      }
    }
  }

  return false;
}

/**
 * Remove semi-transparent pixels that are likely shadow artifacts.
 *
 * @param {ImageData} imageData - Image data
 * @param {number} aggressiveness - How aggressive to be (0-100)
 */
function removeSemiTransparentPixels(imageData, aggressiveness) {
  const { width, height, data } = imageData;

  // More conservative threshold - we want to aggressively remove shadows
  // At aggressiveness 30: threshold = 240 (removes alpha < 240)
  // At aggressiveness 60: threshold = 210 (removes alpha < 210)
  const alphaThreshold = Math.max(200, 255 - (aggressiveness * 1.5));

  for (let i = 0; i < width * height; i++) {
    const index = i * 4;
    const alpha = data[index + 3];

    // Remove semi-transparent pixels below threshold
    if (alpha > 0 && alpha < alphaThreshold) {
      // Check if this is isolated (likely shadow) or part of content
      const x = i % width;
      const y = Math.floor(i / width);

      if (isShadowPixel(data, x, y, width, height)) {
        data[index + 3] = 0; // Make transparent
      }
    }
  }
}

/**
 * Trim transparent padding around a component.
 * Removes empty space and returns trimmed ImageData with new bounds.
 *
 * @param {ImageData} imageData - Source image data
 * @returns {Object} - {imageData: trimmed ImageData, bounds: {x, y, width, height}, isEmpty: boolean}
 */
export function trimTransparentPadding(imageData) {
  const { width, height, data } = imageData;

  // Find bounding box of non-transparent pixels
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = (y * width + x) * 4;
      const alpha = data[index + 3];

      if (alpha > 0) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }

  // Check if image is completely transparent
  if (maxX === -1 || maxY === -1) {
    return {
      imageData: new ImageData(1, 1),
      bounds: { x: 0, y: 0, width: 0, height: 0 },
      isEmpty: true
    };
  }

  // Calculate trimmed dimensions
  const trimmedWidth = maxX - minX + 1;
  const trimmedHeight = maxY - minY + 1;

  // Check if component is too small (likely noise)
  if (trimmedWidth < 3 || trimmedHeight < 3) {
    return {
      imageData: new ImageData(1, 1),
      bounds: { x: 0, y: 0, width: 0, height: 0 },
      isEmpty: true
    };
  }

  // Create trimmed image data
  const trimmedData = new Uint8ClampedArray(trimmedWidth * trimmedHeight * 4);

  for (let y = 0; y < trimmedHeight; y++) {
    for (let x = 0; x < trimmedWidth; x++) {
      const srcIndex = ((minY + y) * width + (minX + x)) * 4;
      const dstIndex = (y * trimmedWidth + x) * 4;

      trimmedData[dstIndex] = data[srcIndex];
      trimmedData[dstIndex + 1] = data[srcIndex + 1];
      trimmedData[dstIndex + 2] = data[srcIndex + 2];
      trimmedData[dstIndex + 3] = data[srcIndex + 3];
    }
  }

  return {
    imageData: new ImageData(trimmedData, trimmedWidth, trimmedHeight),
    bounds: { x: minX, y: minY, width: trimmedWidth, height: trimmedHeight },
    isEmpty: false
  };
}
