#!/usr/bin/env node

/**
 * Simple HTTP server for testing Quadratic embeds
 */

import fs from 'fs';
import http from 'http';
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
  console.log(`\n🌐 Open http://localhost:${PORT}/test-embed.html in your browser`);
  console.log(`\n📋 Embed URL formats:`);
  console.log(`   New:    http://localhost:3000/embed?fileId=<uuid>`);
  console.log(`   Import: http://localhost:3000/embed?import=<url>`);
  console.log(`   Legacy: http://localhost:3000/file/<uuid>?embed\n`);
});
