# Image Grid Analyzer

Automatic nine-slice component extractor for pixel art and UI design. Analyzes image grids, decomposes them into reusable components, and outputs production-ready CSS and JSON.

🔗 **[Live Demo](https://catpea.github.io/auto-slice)**

## Features

- **Zero Dependencies** - No npm packages, no supply chain risks
- **Automatic Grid Detection** - Finds uniform divider lines automatically
- **Shape Decomposition** - Detects primitives (lines, rectangles, rounded corners)
- **Grid Line Analysis** - Extracts and analyzes grid dividers separately from cells
- **Background Removal** - Intelligent flood-fill from corners
- **Nine-Slice Support** - Auto-calculates optimal border widths
- **Multiple Export Formats** - PNG, JSON, and CSS outputs
- **Pan & Zoom** - Navigate large images with mouse/touch controls
- **GitHub Pages Ready** - Works entirely in the browser

## Quick Start

### Run Locally

```bash
# Clone the repository
git clone https://github.com/catpea/auto-slice.git
cd auto-slice

# Start a local server
python3 -m http.server 8000

# Open in browser
open http://localhost:8000
```

### Usage

1. **Load Image** - Click "Load Image" and select your grid image
2. **Analyze** - Click "Analyze Grid" to automatically detect and extract components
3. **Review** - View extracted grid lines and cells with shape analysis
4. **Export** - Click "Export All" to download PNG files, JSON, and CSS

## Architecture

The application is built with vanilla JavaScript ES6 modules:

```
auto-slice/
├── index.html              # Main UI
├── index.js                # Application orchestrator
├── grid-detector.js        # Grid line detection
├── image-splitter.js       # Extract grid lines & cells
├── shape-decomposer.js     # Detect geometric primitives
├── background-remover.js   # Background removal & cleanup
├── pan-zoom.js            # Custom pan-zoom control
├── editor-view.js         # Visual editor interface
├── png-exporter.js        # PNG export
├── json-exporter.js       # JSON metadata export
└── css-exporter.js        # CSS generation
```

## How It Works

### 1. Grid Detection

Analyzes pixel rows and columns for uniform colors:

```javascript
// Detects horizontal and vertical divider lines
const gridConfig = detectGrid(imageData);
// Returns: { rows, columns, horizontalSlices, verticalSlices, cells, gridLineSegments }
```

### 2. Image Splitting

Extracts grid line segments and cells separately:

```javascript
const splitData = splitImage(canvas, gridConfig);
// Returns: { gridLines, cells, allSegments }
```

### 3. Shape Decomposition

Analyzes each segment for geometric primitives:

```javascript
const shapes = decomposeIntoShapes(imageData);
// Detects: lines, rectangles, rounded rectangles
```

### 4. Nine-Slice Calculation

Automatically determines optimal border widths based on detected shapes:

```javascript
const nineSlice = calculateNineSliceBorders(imageData, shapes);
// Returns: { top, right, bottom, left }
```

## Export Formats

### PNG Files

Individual transparent PNG files for each:
- Grid line segments (horizontal, vertical, intersections)
- Cell components (with background removed)

### JSON Metadata

Complete analysis data:

```json
{
  "version": "1.0.0",
  "grid": {
    "rows": 3,
    "columns": 3,
    "horizontalSlices": [100, 200],
    "verticalSlices": [100, 200]
  },
  "components": [
    {
      "id": "h-line-0",
      "type": "horizontal-line",
      "source": { "x": 0, "y": 100, "width": 300, "height": 2 },
      "shapes": [...]
    }
  ]
}
```

### CSS Stylesheets

Ready-to-use nine-slice CSS:

```css
.ui-widget-0-0 {
  border-width: 10px 10px 10px 10px;
  border-style: solid;
  border-color: transparent;
  border-image-source: url('widget-0-0.png');
  border-image-slice: 10 10 10 10 fill;
  border-image-repeat: round;
}
```

## Security

### No External Dependencies

This project uses **zero npm packages** to eliminate supply chain attack risks. All functionality is implemented with vanilla JavaScript.

### Browser-Only Execution

Everything runs client-side in the browser. No server uploads, no external API calls.

### Content Security Policy

Safe to deploy with strict CSP headers:

```
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline';
```

## Browser Compatibility

Works in all modern browsers supporting:
- ES6 Modules
- Canvas API
- FileReader API
- Blob/URL APIs

Tested on:
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Contributing

Contributions welcome! Please ensure:

1. **No external dependencies** - Keep it dependency-free
2. **Vanilla JavaScript** - ES6 modules only
3. **Browser compatibility** - Test in multiple browsers
4. **Code style** - Follow MDN guidelines

## License

MIT License - see LICENSE file for details

## Author

Created by [catpea](https://github.com/catpea)

## Acknowledgments

Built following the [MDN JavaScript guidelines](https://developer.mozilla.org/en-US/docs/MDN/Writing_guidelines/Writing_style_guide/Code_style_guide/JavaScript) and the philosophy that **the image is the instruction set**.
