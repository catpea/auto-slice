# Image Grid Analyzer

Automatic nine-slice component extractor for pixel art and UI design. Analyzes image grids, decomposes them into reusable components, and outputs production-ready CSS and JSON.

🔗 **[Live Demo](https://catpea.github.io/auto-slice)**

## Features

- **Zero Runtime Dependencies** - Production build has no npm packages
- **Automatic Grid Detection** - Finds uniform divider lines automatically
- **Shape Decomposition** - Detects primitives (lines, rectangles, rounded corners)
- **Grid Line Analysis** - Extracts and analyzes grid dividers separately from cells
- **Background Removal** - Intelligent flood-fill from corners
- **Nine-Slice Support** - Auto-calculates optimal border widths
- **Multiple Export Formats** - PNG, JSON, and CSS outputs
- **Pan & Zoom** - Navigate large images with mouse/touch controls
- **GitHub Pages Ready** - Works entirely in the browser

## Development Mode

For development, we provide a debug server with WebSocket communication:

```bash
# Install dev dependencies
npm install

# Start debug server (HTTP + WebSocket)
npm run dev

# Open browser
http://localhost:8080
```

### Debug Server Features

- **HTTP Server** - Serves static files on port 8080
- **WebSocket Server** - Real-time communication on port 8089
- **Auto-inject Debug Client** - Automatically adds WebSocket client to HTML
- **Bidirectional Communication** - Send commands from server, receive logs from browser
- **Performance Monitoring** - Track analysis timing in real-time
- **Test Images** - Includes 5×6 and 6×8 grid samples

### Debug API

The debug server injects `window.debug` into the browser:

```javascript
// Send custom log messages to server
window.debug.log('Message', { data: 'value' });

// Send error messages
window.debug.error('Error message', error);

// Send custom messages
window.debug.send('custom-type', { custom: 'data' });

// Check connection status
window.debug.isConnected();

// Ping server
window.debug.ping();
```

### Server Console Output

The debug server displays:
- Grid detection results
- Component analysis
- Performance metrics
- Shape detection details
- Error logging

Example output:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Analysis Complete
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Grid Configuration: 5×6
Grid Line Segments: 22
Cell Components:    30
Total Shapes:       45
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📏 Grid Line Segments:
  - h-line-0: 640×2 (1 shapes)
  - v-line-0: 2×480 (1 shapes)
  ...

📦 Cell Components:
  - widget-0-0: 100×75 (2 shapes, 9-slice: 18/18/18/18)
  ...
```

## Production Mode

For production (GitHub Pages), all dependencies are removed:

```bash
# No build step needed - just deploy files
# Works as static files with zero dependencies
```

## Quick Start

### Usage

1. **Load Image** - Click "Load Image" and select your grid image
2. **Analyze** - Click "Analyze Grid" to automatically detect and extract components
3. **Review** - View extracted grid lines and cells with shape analysis
4. **Export** - Click "Export All" to download PNG files, JSON, and CSS

### Test Images

Try the included samples:
- `samples/5x6-example-1.jpg` - 5×6 grid configuration
- `samples/6x8-example-2.jpg` - 6×8 grid configuration

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
├── css-exporter.js        # CSS generation
└── debug-server.js        # Development server (dev only)
```

## How It Works

### 1. Grid Detection

Analyzes pixel rows and columns for uniform colors:

```javascript
// Detects horizontal and vertical divider lines
const gridConfig = detectGrid(imageData);
// Returns: { rows, columns, horizontalSlices, verticalSlices,
//           cells, gridLineSegments }
```

### 2. Image Splitting

Extracts grid line segments and cells separately:

```javascript
const splitData = splitImage(canvas, gridConfig);
// Returns: { gridLines, cells, allSegments }
```

Grid line segments include:
- **Horizontal lines** - Full-width divider rows
- **Vertical lines** - Full-height divider columns
- **Intersections** - Where horizontal and vertical lines cross

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

### No Production Dependencies

Production build uses **zero npm packages** to eliminate supply chain attack risks. All functionality is implemented with vanilla JavaScript.

### Development Dependencies

Development mode uses `ws` for WebSocket debugging. This is **not** included in production builds.

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

1. **No production dependencies** - Keep runtime dependency-free
2. **Vanilla JavaScript** - ES6 modules only
3. **Browser compatibility** - Test in multiple browsers
4. **Code style** - Follow MDN guidelines
5. **Dev dependencies OK** - Tools for development are fine

## License

MIT License - see LICENSE file for details

## Author

Created by [catpea](https://github.com/catpea)

## Acknowledgments

Built following the [MDN JavaScript guidelines](https://developer.mozilla.org/en-US/docs/MDN/Writing_guidelines/Writing_style_guide/Code_style_guide/JavaScript) and the philosophy that **the image is the instruction set**.
