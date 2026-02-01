#!/usr/bin/env node

/**
 * Simple HTTP server for testing Quadratic embeds
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 8081;
const HTML_FILE = path.join(__dirname, 'test-embed.html');

const server = http.createServer((req, res) => {
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
  console.log(`\n🌐 Open http://localhost:${PORT}/test-embed.html in your browser\n`);
});
