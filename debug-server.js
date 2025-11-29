#!/usr/bin/env node

/**
 * Debug Server for Auto-Slice Development
 * Provides HTTP server + WebSocket for bidirectional communication
 *
 * Usage: node debug-server.js
 */

import { createServer } from 'http';
import { readFileSync, statSync } from 'fs';
import { extname, join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { WebSocketServer } from 'ws';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const HTTP_PORT = 8085;
const WS_PORT = 8089;

// MIME types for static files
const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.mjs': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

// Connected WebSocket clients
const clients = new Set();

// ============================================================================
// HTTP Server - Serves static files
// ============================================================================

const httpServer = createServer((req, res) => {
  console.log(`[HTTP] ${req.method} ${req.url}`);

  let filePath = req.url === '/' ? '/index.html' : req.url;
  filePath = join(__dirname, filePath);

  try {
    const stat = statSync(filePath);

    if (stat.isDirectory()) {
      filePath = join(filePath, 'index.html');
    }

    const ext = extname(filePath);
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    const content = readFileSync(filePath);

    // Inject WebSocket client code for HTML files
    if (ext === '.html') {
      const injectedContent = injectDebugClient(content.toString());
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(injectedContent);
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    }
  } catch (error) {
    if (error.code === 'ENOENT') {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
    } else {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('500 Internal Server Error');
    }
  }
});

httpServer.listen(HTTP_PORT, () => {
  console.log(`\n🚀 Auto-Slice Debug Server`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`📡 HTTP Server: http://localhost:${HTTP_PORT}`);
  console.log(`🔌 WebSocket:   ws://localhost:${WS_PORT}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
  console.log(`Available test images:`);
  console.log(`  - samples/5x6-example-1.jpg (5x6 grid)`);
  console.log(`  - samples/6x8-example-2.jpg (6x8 grid)`);
  console.log(`\n💡 Open http://localhost:${HTTP_PORT} to start\n`);
});

// ============================================================================
// WebSocket Server - Bidirectional communication
// ============================================================================

const wss = new WebSocketServer({ port: WS_PORT });

wss.on('connection', (ws) => {
  console.log('[WS] Client connected');
  clients.add(ws);

  // Send welcome message
  ws.send(JSON.stringify({
    type: 'connected',
    message: 'Debug server connected',
    timestamp: Date.now()
  }));

  ws.on('error', (error) => {
    console.error('[WS] Error:', error);
  });

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data);
      handleClientMessage(ws, message);
    } catch (error) {
      console.error('[WS] Failed to parse message:', error);
    }
  });

  ws.on('close', () => {
    console.log('[WS] Client disconnected');
    clients.delete(ws);
  });
});

// ============================================================================
// Message Handlers
// ============================================================================

function handleClientMessage(ws, message) {
  console.log(`[WS] Received:`, message.type);

  switch (message.type) {
    case 'log':
      console.log(`[CLIENT] ${message.level.toUpperCase()}:`, message.message);
      if (message.data) {
        console.log('[CLIENT] Data:', JSON.stringify(message.data, null, 2));
      }
      break;

    case 'analysis-start':
      console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`🔬 Analysis Started`);
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
      break;

    case 'analysis-complete':
      console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`✅ Analysis Complete`);
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`Grid Configuration: ${message.data.gridConfig.columns}×${message.data.gridConfig.rows}`);
      console.log(`Grid Line Segments: ${message.data.gridLineComponents.length}`);
      console.log(`Cell Components:    ${message.data.components.length}`);
      console.log(`Total Shapes:       ${message.data.totalShapes}`);
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

      // Display grid line details
      if (message.data.gridLineComponents.length > 0) {
        console.log(`\n📏 Grid Line Segments:`);
        message.data.gridLineComponents.forEach(comp => {
          console.log(`  - ${comp.id}: ${comp.width}×${comp.height} (${comp.shapes.length} shapes)`);
        });
      }

      // Display cell details
      if (message.data.components.length > 0) {
        console.log(`\n📦 Cell Components:`);
        message.data.components.forEach(comp => {
          const nineSlice = comp.nineSlice
            ? `9-slice: ${comp.nineSlice.top}/${comp.nineSlice.right}/${comp.nineSlice.bottom}/${comp.nineSlice.left}`
            : 'no 9-slice';
          console.log(`  - ${comp.name}: ${comp.width}×${comp.height} (${comp.shapes.length} shapes, ${nineSlice})`);
        });
      }
      console.log('');
      break;

    case 'grid-detected':
      console.log(`\n📊 Grid Detected:`);
      console.log(`  Configuration: ${message.data.columns}×${message.data.rows}`);
      console.log(`  Horizontal lines: ${message.data.horizontalSlices.length}`);
      console.log(`  Vertical lines:   ${message.data.verticalSlices.length}`);
      console.log(`  Cells:            ${message.data.cells.length}`);
      console.log(`  Grid segments:    ${message.data.gridLineSegments.length}`);
      break;

    case 'performance':
      console.log(`\n⚡ Performance:`);
      console.log(`  ${message.operation}: ${message.duration}ms`);
      break;

    case 'error':
      console.error(`\n❌ Error:`, message.error);
      if (message.stack) {
        console.error(message.stack);
      }
      break;

    case 'ping':
      ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
      break;

    default:
      console.log(`[WS] Unknown message type:`, message.type);
  }
}

// ============================================================================
// Broadcast to all clients
// ============================================================================

function broadcast(message) {
  const data = JSON.stringify(message);
  clients.forEach(client => {
    if (client.readyState === 1) { // WebSocket.OPEN
      client.send(data);
    }
  });
}

// ============================================================================
// Debug Commands (can be called from Node REPL or other scripts)
// ============================================================================

// Example: Send command to load specific test image
export function loadTestImage(filename) {
  broadcast({
    type: 'command',
    action: 'load-image',
    filename: filename
  });
  console.log(`[CMD] Sent load-image command: ${filename}`);
}

// Example: Request analysis
export function requestAnalysis() {
  broadcast({
    type: 'command',
    action: 'analyze'
  });
  console.log(`[CMD] Sent analyze command`);
}

// Example: Clear output
export function clearOutput() {
  broadcast({
    type: 'command',
    action: 'clear'
  });
  console.log(`[CMD] Sent clear command`);
}

// ============================================================================
// Inject Debug Client Code
// ============================================================================

function injectDebugClient(html) {
  const debugClientScript = `
  <script>
    // Debug WebSocket Client
    (function() {
      const ws = new WebSocket('ws://localhost:${WS_PORT}');
      let connected = false;

      ws.onopen = () => {
        connected = true;
        console.log('[DEBUG] Connected to debug server');
      };

      ws.onerror = (error) => {
        console.error('[DEBUG] WebSocket error:', error);
      };

      ws.onclose = () => {
        connected = false;
        console.log('[DEBUG] Disconnected from debug server');
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          handleServerMessage(message);
        } catch (error) {
          console.error('[DEBUG] Failed to parse server message:', error);
        }
      };

      function handleServerMessage(message) {
        console.log('[DEBUG] Server message:', message.type);

        switch (message.type) {
          case 'connected':
            console.log('[DEBUG]', message.message);
            break;

          case 'command':
            handleCommand(message);
            break;

          case 'pong':
            console.log('[DEBUG] Pong received');
            break;

          default:
            console.log('[DEBUG] Unknown message type:', message.type);
        }
      }

      function handleCommand(message) {
        console.log('[DEBUG] Command:', message.action);

        switch (message.action) {
          case 'load-image':
            // Trigger image load
            console.log('[DEBUG] Loading image:', message.filename);
            // You can implement this to programmatically load images
            break;

          case 'analyze':
            // Trigger analysis
            const analyzeBtn = document.getElementById('analyze-btn');
            if (analyzeBtn && !analyzeBtn.disabled) {
              analyzeBtn.click();
            }
            break;

          case 'clear':
            // Clear output
            const output = document.getElementById('output');
            if (output) {
              output.hidden = true;
            }
            break;
        }
      }

      // Expose debug API to window
      window.debug = {
        send: (type, data) => {
          if (connected) {
            ws.send(JSON.stringify({ type, ...data, timestamp: Date.now() }));
          } else {
            console.warn('[DEBUG] Not connected to server');
          }
        },

        log: (message, data) => {
          console.log('[CLIENT]', message, data);
          if (connected) {
            ws.send(JSON.stringify({
              type: 'log',
              level: 'info',
              message,
              data,
              timestamp: Date.now()
            }));
          }
        },

        error: (message, error) => {
          console.error('[CLIENT]', message, error);
          if (connected) {
            ws.send(JSON.stringify({
              type: 'error',
              error: message,
              stack: error?.stack,
              timestamp: Date.now()
            }));
          }
        },

        ping: () => {
          if (connected) {
            ws.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
          }
        },

        isConnected: () => connected
      };

      console.log('[DEBUG] Debug API available at window.debug');
    })();
  </script>
  `;

  // Inject before closing body tag
  return html.replace('</body>', `${debugClientScript}</body>`);
}

// ============================================================================
// Command Line Interface
// ============================================================================

console.log(`\n💡 Debug Commands:`);
console.log(`  - import { loadTestImage, requestAnalysis, clearOutput } from './debug-server.js'`);
console.log(`  - loadTestImage('samples/5x6-example-1.jpg')`);
console.log(`  - requestAnalysis()`);
console.log(`  - clearOutput()`);
console.log(``);
