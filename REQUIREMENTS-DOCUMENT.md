# Image Grid Analyzer & Nine-Slice Decomposer

## AI Instructions for Claude Sonnet 4.5

Build a program that treats groups of images as instructions for generative animation.
The program analyzes image grids, decomposes them into reusable components, and outputs
production-ready CSS and JSON for dynamic styling and resizing.

---

## Project Philosophy

This tool bridges the gap between static pixel art and dynamic web interfaces.
Artists draw UI mockups; this program extracts the underlying geometry and produces
code that makes those designs come alive at any size.

**Core Principle**: The image is the instruction set. Every line, rectangle, and
rounded corner is data waiting to be extracted.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        IMAGE GRID ANALYZER                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐          │
│  │   1. GRID    │ -> │  2. CLEANUP  │ -> │  3. DECOMP   │          │
│  │   DETECTOR   │    │   & ISOLATE  │    │   ENGINE     │          │
│  └──────────────┘    └──────────────┘    └──────────────┘          │
│         │                   │                   │                   │
│         v                   v                   v                   │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐          │
│  │ Slice Lines  │    │ Transparent  │    │  Primitives  │          │
│  │ Coordinates  │    │   Regions    │    │   (shapes)   │          │
│  └──────────────┘    └──────────────┘    └──────────────┘          │
│                                                                     │
│                              │                                      │
│                              v                                      │
│                    ┌──────────────────┐                             │
│                    │   4. EXPORTER    │                             │
│                    │  PNG / JSON / CSS │                            │
│                    └──────────────────┘                             │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Module 1: Grid Detector

### Purpose

Automatically detect where slice lines exist in an image grid.
The user provides a composite image; the program finds the boundaries.

### Detection Strategies

```javascript
// grid-detector.js

/**
 * Detect grid configuration from an image.
 * Analyzes pixel rows and columns for consistent divider patterns.
 *
 * @param {ImageData} imageData - Canvas image data
 * @returns {GridConfig} - Detected grid configuration
 */
export function detectGrid(imageData) {
  const { width, height, data } = imageData;

  const horizontalLines = findHorizontalDividers(data, width, height);
  const verticalLines = findVerticalDividers(data, width, height);

  return {
    rows: horizontalLines.length + 1,
    columns: verticalLines.length + 1,
    horizontalSlices: horizontalLines,
    verticalSlices: verticalLines,
    cells: computeCells(horizontalLines, verticalLines, width, height)
  };
}

/**
 * Find horizontal divider lines by analyzing row uniformity.
 * A divider is a row where all pixels share the same color (or transparency).
 *
 * @param {Uint8ClampedArray} data - Pixel data (RGBA)
 * @param {number} width - Image width
 * @param {number} height - Image height
 * @returns {number[]} - Y coordinates of horizontal dividers
 */
function findHorizontalDividers(data, width, height) {
  const dividers = [];

  for (let y = 0; y < height; y++) {
    if (isUniformRow(data, width, y)) {
      dividers.push(y);
    }
  }

  return consolidateDividers(dividers);
}

/**
 * Check if a row has uniform color (potential divider).
 */
function isUniformRow(data, width, y) {
  const startIndex = y * width * 4;
  const firstPixel = {
    r: data[startIndex],
    g: data[startIndex + 1],
    b: data[startIndex + 2],
    a: data[startIndex + 3]
  };

  for (let x = 1; x < width; x++) {
    const index = (y * width + x) * 4;
    if (
      data[index] !== firstPixel.r ||
      data[index + 1] !== firstPixel.g ||
      data[index + 2] !== firstPixel.b ||
      data[index + 3] !== firstPixel.a
    ) {
      return false;
    }
  }

  return true;
}

/**
 * Consolidate consecutive divider lines into single slice points.
 * Multiple uniform rows in sequence become one slice at the center.
 */
function consolidateDividers(dividers) {
  if (dividers.length === 0) return [];

  const consolidated = [];
  let groupStart = dividers[0];
  let groupEnd = dividers[0];

  for (let i = 1; i < dividers.length; i++) {
    if (dividers[i] === groupEnd + 1) {
      groupEnd = dividers[i];
    } else {
      consolidated.push(Math.floor((groupStart + groupEnd) / 2));
      groupStart = dividers[i];
      groupEnd = dividers[i];
    }
  }

  consolidated.push(Math.floor((groupStart + groupEnd) / 2));
  return consolidated;
}
```

### Alternative Detection: Edge-Based

```javascript
// edge-detector.js

/**
 * Detect grid using edge detection (Sobel operator).
 * Useful when dividers are subtle gradients rather than solid lines.
 */
export function detectGridByEdges(imageData, threshold = 30) {
  const edges = applySobelOperator(imageData);
  const horizontalProjection = projectHorizontally(edges);
  const verticalProjection = projectVertically(edges);

  return {
    horizontalSlices: findPeaks(horizontalProjection, threshold),
    verticalSlices: findPeaks(verticalProjection, threshold)
  };
}

/**
 * Simple Sobel edge detection.
 */
function applySobelOperator(imageData) {
  const { width, height, data } = imageData;
  const grayscale = toGrayscale(data, width, height);
  const edges = new Float32Array(width * height);

  const sobelX = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
  const sobelY = [-1, -2, -1, 0, 0, 0, 1, 2, 1];

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let gx = 0;
      let gy = 0;

      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const pixel = grayscale[(y + ky) * width + (x + kx)];
          const kernelIndex = (ky + 1) * 3 + (kx + 1);
          gx += pixel * sobelX[kernelIndex];
          gy += pixel * sobelY[kernelIndex];
        }
      }

      edges[y * width + x] = Math.sqrt(gx * gx + gy * gy);
    }
  }

  return { edges, width, height };
}
```

---

## Module 2: Background Removal & Cleanup

### Purpose

Remove backgrounds and shadows exposed by slicing.
Clean up edge artifacts to produce pristine transparent PNGs.

### Implementation

```javascript
// background-remover.js

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
 * Sample colors from image corners (likely background).
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
 * Create a binary mask identifying background pixels.
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
 */
function colorDistance(color1, color2) {
  const dr = color1.r - color2.r;
  const dg = color1.g - color2.g;
  const db = color1.b - color2.b;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

/**
 * Flood fill from image edges to find connected background.
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
```

### Shadow Removal

```javascript
// shadow-remover.js

/**
 * Remove shadows along slice edges.
 * Shadows appear as gradients near cut lines.
 *
 * @param {ImageData} imageData - Image data
 * @param {number[]} sliceLines - Positions of slice lines
 * @param {number} shadowWidth - Expected shadow width in pixels
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
 * Determine if a pixel is likely a shadow artifact.
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
```

---

## Module 3: Shape Decomposition Engine

### Purpose

Analyze extracted slices and detect geometric primitives:
horizontal lines, vertical lines, rectangles, and rounded rectangles.

### Implementation

```javascript
// shape-decomposer.js

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
  if (!bounds) return { shapes: [], isEmpty: true };

  // Analyze the shape
  const shapes = [];

  // Check for lines
  const horizontalLines = detectHorizontalLines(imageData, bounds);
  const verticalLines = detectVerticalLines(imageData, bounds);

  shapes.push(...horizontalLines, ...verticalLines);

  // Check for rectangles
  const rectangles = detectRectangles(imageData, bounds);
  shapes.push(...rectangles);

  // Check for rounded rectangles
  const roundedRects = detectRoundedRectangles(imageData, bounds);
  shapes.push(...roundedRects);

  return {
    shapes,
    bounds,
    isEmpty: shapes.length === 0
  };
}

/**
 * Find the bounding box of non-transparent pixels.
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
 * Detect rectangles (filled regions with straight edges).
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
 * Detect rounded rectangles by analyzing corner curvature.
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
```

---

## Module 4: Exporter

### PNG Export

```javascript
// png-exporter.js

/**
 * Export processed components as transparent PNGs.
 *
 * @param {ProcessedComponent[]} components - Extracted components
 * @returns {Promise<Blob[]>} - Array of PNG blobs
 */
export async function exportToPNG(components) {
  const pngBlobs = [];

  for (const component of components) {
    const canvas = document.createElement('canvas');
    canvas.width = component.width;
    canvas.height = component.height;

    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false; // Preserve pixel art
    ctx.putImageData(component.imageData, 0, 0);

    const blob = await new Promise(resolve => {
      canvas.toBlob(resolve, 'image/png');
    });

    pngBlobs.push({
      name: component.name,
      blob: blob,
      width: component.width,
      height: component.height
    });
  }

  return pngBlobs;
}
```

### JSON Export

```javascript
// json-exporter.js

/**
 * Export slice configuration as JSON.
 *
 * @param {GridConfig} gridConfig - Detected grid configuration
 * @param {ProcessedComponent[]} components - Extracted components
 * @returns {string} - JSON string
 */
export function exportToJSON(gridConfig, components) {
  const output = {
    version: '1.0.0',
    generated: new Date().toISOString(),

    grid: {
      rows: gridConfig.rows,
      columns: gridConfig.columns,
      horizontalSlices: gridConfig.horizontalSlices,
      verticalSlices: gridConfig.verticalSlices
    },

    components: components.map(component => ({
      id: component.id,
      name: component.name,

      source: {
        x: component.sourceX,
        y: component.sourceY,
        width: component.width,
        height: component.height
      },

      nineSlice: component.nineSlice ? {
        top: component.nineSlice.top,
        right: component.nineSlice.right,
        bottom: component.nineSlice.bottom,
        left: component.nineSlice.left
      } : null,

      shapes: component.shapes.map(shape => ({
        type: shape.type,
        bounds: { x: shape.x, y: shape.y, width: shape.width, height: shape.height },
        color: shape.color ? `rgba(${shape.color.r}, ${shape.color.g}, ${shape.color.b}, ${shape.color.a / 255})` : null,
        cornerRadius: shape.cornerRadius || 0
      })),

      output: {
        filename: `${component.name}.png`,
        cssClass: `.ui-${component.name}`
      }
    }))
  };

  return JSON.stringify(output, null, 2);
}
```

### CSS Export

```javascript
// css-exporter.js

/**
 * Generate CSS for border-image and pseudo-elements.
 *
 * @param {ProcessedComponent[]} components - Extracted components
 * @param {string} imageBasePath - Base path for image URLs
 * @returns {string} - CSS stylesheet content
 */
export function exportToCSS(components, imageBasePath = './') {
  const cssBlocks = [];

  // Header comment
  cssBlocks.push(`/**
 * Nine-Slice UI Components
 * Generated by Image Grid Analyzer
 * ${new Date().toISOString()}
 */
`);

  // CSS custom properties for easy theming
  cssBlocks.push(`:root {
  --nine-slice-base-path: '${imageBasePath}';
}
`);

  for (const component of components) {
    const className = `ui-${component.name}`;
    const imagePath = `${imageBasePath}${component.name}.png`;

    // Main border-image style
    if (component.nineSlice) {
      const { top, right, bottom, left } = component.nineSlice;

      cssBlocks.push(`/* Component: ${component.name} */
.${className} {
  border-width: ${top}px ${right}px ${bottom}px ${left}px;
  border-style: solid;
  border-color: transparent;
  border-image-source: url('${imagePath}');
  border-image-slice: ${top} ${right} ${bottom} ${left} fill;
  border-image-repeat: round;
  box-sizing: border-box;
}

.${className}--stretch {
  border-image-repeat: stretch;
}

.${className}--repeat {
  border-image-repeat: repeat;
}

.${className}--space {
  border-image-repeat: space;
}
`);
    }

    // Pseudo-element variants for more control
    cssBlocks.push(`.${className}-pseudo {
  position: relative;
}

.${className}-pseudo::before {
  content: '';
  position: absolute;
  inset: 0;
  background-image: url('${imagePath}');
  background-size: 100% 100%;
  background-repeat: no-repeat;
  pointer-events: none;
  z-index: -1;
}
`);

    // Corner-only variant using ::before and ::after
    if (component.nineSlice) {
      const { top, left, right, bottom } = component.nineSlice;

      cssBlocks.push(`.${className}-corners {
  position: relative;
}

.${className}-corners::before,
.${className}-corners::after {
  content: '';
  position: absolute;
  background-image: url('${imagePath}');
  background-repeat: no-repeat;
  pointer-events: none;
}

/* Top-left corner */
.${className}-corners::before {
  top: 0;
  left: 0;
  width: ${left}px;
  height: ${top}px;
  background-position: 0 0;
}

/* Additional corners require extra elements or CSS Grid */
`);
    }

    // Utility class for dynamic sizing
    cssBlocks.push(`.${className}--fluid {
  min-width: ${component.nineSlice ? component.nineSlice.left + component.nineSlice.right : 0}px;
  min-height: ${component.nineSlice ? component.nineSlice.top + component.nineSlice.bottom : 0}px;
}
`);
  }

  return cssBlocks.join('\n');
}
```

---

## Module 5: Panner-Zoomer Integration

### Purpose

Use panner-zoomer for navigating large source images during analysis.

### Implementation

```javascript
// editor-view.js

import 'panner-zoomer';

/**
 * Create an interactive editor view for image analysis.
 */
export function createEditorView(container, sourceImage) {
  // Create panner-zoomer container
  const pannerZoomer = document.createElement('panner-zoomer');
  pannerZoomer.id = 'image-editor';
  pannerZoomer.style.cssText = `
    display: block;
    width: 100%;
    height: 600px;
    background: #1a1a1a;
  `;

  // Create canvas for image display
  const canvas = document.createElement('canvas');
  canvas.width = sourceImage.width;
  canvas.height = sourceImage.height;
  canvas.style.cssText = `
    position: absolute;
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
    pointer-events: none;
  `;

  // Assemble
  pannerZoomer.appendChild(canvas);
  pannerZoomer.appendChild(overlay);
  container.appendChild(pannerZoomer);

  // Add controls
  const controls = document.createElement('panner-zoomer-controls');
  controls.setAttribute('target', 'image-editor');
  controls.setAttribute('placement', 'ne');
  container.appendChild(controls);

  return {
    pannerZoomer,
    canvas,
    overlay,
    ctx,
    overlayCtx: overlay.getContext('2d'),

    /**
     * Draw detected grid lines on overlay.
     */
    drawGridLines(gridConfig) {
      const overlayCtx = overlay.getContext('2d');
      overlayCtx.clearRect(0, 0, overlay.width, overlay.height);

      // Draw horizontal slice lines
      overlayCtx.strokeStyle = 'rgba(255, 0, 0, 0.7)';
      overlayCtx.lineWidth = 1;

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
     */
    highlightCell(cell, color = 'rgba(255, 255, 0, 0.3)') {
      const overlayCtx = overlay.getContext('2d');
      overlayCtx.fillStyle = color;
      overlayCtx.fillRect(cell.x, cell.y, cell.width, cell.height);
    }
  };
}
```

---

## Module 6: Main Application

### Entry Point

```javascript
// index.js

import { detectGrid } from './grid-detector.js';
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
  }

  /**
   * Load an image for analysis.
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
    ctx.drawImage(this.sourceImage, 0, 0);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    // Step 1: Detect grid
    this.gridConfig = detectGrid(imageData);
    this.editorView.drawGridLines(this.gridConfig);

    // Step 2: Extract and process each cell
    this.components = [];

    for (let i = 0; i < this.gridConfig.cells.length; i++) {
      const cell = this.gridConfig.cells[i];
      const cellImageData = ctx.getImageData(cell.x, cell.y, cell.width, cell.height);

      // Remove background
      const cleanedData = removeBackground(cellImageData);

      // Remove shadows along slice edges
      removeShadowsAlongSlices(cleanedData, [0, cell.height - 1], 3);

      // Decompose into shapes
      const shapes = decomposeIntoShapes(cleanedData);

      // Calculate nine-slice borders
      const nineSlice = calculateNineSliceBorders(cleanedData, shapes);

      this.components.push({
        id: `component-${i}`,
        name: `widget-${i + 1}`,
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
      components: this.components
    };
  }

  /**
   * Export all outputs.
   */
  async export() {
    const pngBlobs = await exportToPNG(this.components);
    const jsonOutput = exportToJSON(this.gridConfig, this.components);
    const cssOutput = exportToCSS(this.components);

    return {
      pngBlobs,
      json: jsonOutput,
      css: cssOutput
    };
  }
}

/**
 * Calculate nine-slice border widths from shape analysis.
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
```

---

## File Structure

```
image-grid-analyzer/
├── index.html
├── index.js                    # Main application entry
├── grid-detector.js            # Grid detection algorithms
├── edge-detector.js            # Edge-based detection (Sobel)
├── background-remover.js       # Background removal
├── shadow-remover.js           # Shadow cleanup
├── shape-decomposer.js         # Shape detection
├── png-exporter.js             # PNG export
├── json-exporter.js            # JSON export
├── css-exporter.js             # CSS export
├── editor-view.js              # Panner-zoomer integration
├── package.json
└── README.md
```

---

## package.json

```json
{
  "name": "image-grid-analyzer",
  "version": "1.0.0",
  "description": "Analyze image grids and decompose into nine-slice components",
  "type": "module",
  "main": "index.js",
  "scripts": {
    "start": "npx serve ."
  },
  "dependencies": {
    "panner-zoomer": "^1.0.0"
  },
  "devDependencies": {
    "serve": "^14.0.0"
  },
  "keywords": [
    "nine-slice",
    "9-slice",
    "pixel-art",
    "ui-components",
    "image-analysis"
  ],
  "license": "MIT"
}
```

---

## HTML Entry Point

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Image Grid Analyzer</title>
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

    .app-container {
      max-width: 1200px;
      margin: 0 auto;
    }

    h1 {
      margin: 0 0 20px;
    }

    .toolbar {
      display: flex;
      gap: 10px;
      margin-bottom: 20px;
    }

    button {
      padding: 10px 20px;
      background: #4a9eff;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
    }

    button:hover {
      background: #3a8eef;
    }

    button:disabled {
      background: #666;
      cursor: not-allowed;
    }

    .editor-container {
      border: 1px solid #333;
      border-radius: 8px;
      overflow: hidden;
      margin-bottom: 20px;
    }

    .output-panel {
      background: #1a1a1a;
      border-radius: 8px;
      padding: 20px;
    }

    .output-panel h2 {
      margin: 0 0 15px;
      font-size: 18px;
    }

    pre {
      background: #0a0a0a;
      padding: 15px;
      border-radius: 4px;
      overflow-x: auto;
      font-size: 12px;
      max-height: 300px;
    }

    .component-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
      gap: 15px;
      margin-top: 20px;
    }

    .component-preview {
      background: #2a2a2a;
      padding: 10px;
      border-radius: 4px;
      text-align: center;
    }

    .component-preview canvas {
      max-width: 100%;
      image-rendering: pixelated;
      background: repeating-conic-gradient(#333 0% 25%, #222 0% 50%) 50% / 10px 10px;
    }

    .component-preview p {
      margin: 10px 0 0;
      font-size: 12px;
      color: #888;
    }
  </style>
</head>
<body>
  <div class="app-container">
    <h1>🔍 Image Grid Analyzer</h1>

    <div class="toolbar">
      <input type="file" id="file-input" accept="image/*" hidden>
      <button id="load-btn">🖼️ Load Image</button>
      <button id="analyze-btn" disabled>🔬 Analyze Grid</button>
      <button id="export-btn" disabled>💾 Export All</button>
    </div>

    <div class="editor-container" id="editor"></div>

    <div class="output-panel" id="output" hidden>
      <h2>📊 Analysis Results</h2>
      <div class="component-grid" id="components"></div>

      <h2 style="margin-top: 30px;">📄 JSON Output</h2>
      <pre id="json-output"></pre>

      <h2 style="margin-top: 30px;">🎨 CSS Output</h2>
      <pre id="css-output"></pre>
    </div>
  </div>

  <script type="module">
    import { ImageGridAnalyzer } from './index.js';

    const app = new ImageGridAnalyzer(document.getElementById('editor'));

    document.getElementById('load-btn').addEventListener('click', () => {
      document.getElementById('file-input').click();
    });

    document.getElementById('file-input').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (file) {
        await app.loadImage(file);
        document.getElementById('analyze-btn').disabled = false;
      }
    });

    document.getElementById('analyze-btn').addEventListener('click', () => {
      const results = app.analyze();
      displayResults(results);
      document.getElementById('export-btn').disabled = false;
    });

    document.getElementById('export-btn').addEventListener('click', async () => {
      const exports = await app.export();

      // Download files
      downloadFile('components.json', exports.json, 'application/json');
      downloadFile('components.css', exports.css, 'text/css');

      for (const png of exports.pngBlobs) {
        downloadBlob(`${png.name}.png`, png.blob);
      }
    });

    function displayResults(results) {
      document.getElementById('output').hidden = false;

      // Show components
      const container = document.getElementById('components');
      container.innerHTML = '';

      for (const component of results.components) {
        const preview = document.createElement('div');
        preview.className = 'component-preview';

        const canvas = document.createElement('canvas');
        canvas.width = component.width;
        canvas.height = component.height;

        const ctx = canvas.getContext('2d');
        ctx.putImageData(component.imageData, 0, 0);

        const label = document.createElement('p');
        label.textContent = `${component.name} (${component.width}×${component.height})`;

        preview.appendChild(canvas);
        preview.appendChild(label);
        container.appendChild(preview);
      }

      // Show JSON
      const jsonOutput = exportToJSON(results.gridConfig, results.components);
      document.getElementById('json-output').textContent = jsonOutput;

      // Show CSS
      const cssOutput = exportToCSS(results.components);
      document.getElementById('css-output').textContent = cssOutput;
    }

    function downloadFile(filename, content, mimeType) {
      const blob = new Blob([content], { type: mimeType });
      downloadBlob(filename, blob);
    }

    function downloadBlob(filename, blob) {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    }
  </script>
</body>
</html>
```

---

## Code Style Notes (MDN Guidelines)

1. **Use vanilla JavaScript** — No frameworks, just ES6 modules
2. **Clear function names** — `detectGrid`, `removeBackground`, `decomposeIntoShapes`
3. **JSDoc comments** — Every public function documented
4. **Short, focused functions** — Each does one thing well
5. **No abbreviations** — `backgroundColor` not `bgColor`
6. **Template literals** — For multi-line strings and interpolation
7. **const/let** — Never var
8. **No dependencies** — Except panner-zoomer as specified
9. **Pixel-perfect rendering** — `imageSmoothingEnabled = false`
10. **Progressive enhancement** — Works without JavaScript for static display

---

## Testing Checklist

- [ ] Load PNG, JPG, GIF images
- [ ] Detect grids with 2×2, 3×3, 4×4 configurations
- [ ] Handle images with no clear grid (single component)
- [ ] Remove solid color backgrounds
- [ ] Remove gradient backgrounds
- [ ] Detect horizontal lines
- [ ] Detect vertical lines
- [ ] Detect rectangles
- [ ] Detect rounded rectangles
- [ ] Export valid PNG files
- [ ] Export valid JSON structure
- [ ] Export working CSS border-image
- [ ] Panner-zoomer navigation works
- [ ] Grid overlay displays correctly

---

## Future Enhancements

1. **Machine learning grid detection** — Train a model on UI mockups
2. **Automatic nine-slice optimization** — Find optimal slice positions
3. **Animation keyframe extraction** — Detect animation sequences
4. **SVG export** — Convert detected shapes to vector
5. **Spritesheet generation** — Combine all components
6. **Live preview** — Show CSS applied to sample elements

