#!/usr/bin/env node

/**
 * Simple HTTP server for testing Quadratic embeds
 * Sets required headers for SharedArrayBuffer support
 */

import fs from 'fs';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 8081;
// HTML file is in test/embed directory (relative to repo root)
const HTML_FILE = path.join(__dirname, '..', 'test', 'embed', 'test-embed.html');

const server = http.createServer((req, res) => {
  // Set headers required for SharedArrayBuffer
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');

  // Set content type
  res.setHeader('Content-Type', 'text/html; charset=utf-8');

  // Read and serve the HTML file
  fs.readFile(HTML_FILE, 'utf8', (err, data) => {
    if (err) {
      res.writeHead(500);
      res.end('Error loading test-embed.html');
      return;
    }

    res.writeHead(200);
    res.end(data);
  });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`\n✅ Test embed server running at http://localhost:${PORT}/test-embed.html`);
  console.log(`\n📝 This server sets the required headers for SharedArrayBuffer support.`);
  console.log(`\n🌐 Open http://localhost:${PORT}/test-embed.html in your browser\n`);
});
