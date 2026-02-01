# Quadratic Embedding Tests

This directory contains tools for testing Quadratic's embeddability in other web pages.

## Files

- **`test-embed.html`** - Test page for embedding Quadratic spreadsheets in an iframe
- **`test-embed-server.js`** - HTTP server that serves the test page

## Usage

### Running the Test Server

From the repository root:

```bash
npm run test:embed
```

Or directly:

```bash
node test/embed/test-embed-server.js
```

The server will start on `http://localhost:8081` (or the port specified by the `PORT` environment variable).

### Testing Embedding

1. Start the test server (see above)
2. Open `http://localhost:8081/test-embed.html` in your browser
3. Enter a file UUID from your Quadratic dashboard
4. Click "Load Embed" (production) or "Load Local" (localhost:3000)
