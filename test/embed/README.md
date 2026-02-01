# Quadratic Embedding Tests

This directory contains tools and documentation for testing Quadratic's embeddability in other web pages.

## Files

- **`test-embed.html`** - Test page for embedding Quadratic spreadsheets in an iframe
- **`test-embed-server.js`** - HTTP server that serves the test page with required headers for SharedArrayBuffer support
- **`EMBEDDING_SHAREDARRAYBUFFER.md`** - Documentation about SharedArrayBuffer limitations and potential solutions

## Usage

### Running the Test Server

From the `quadratic-client` directory:

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

### Important Notes

- The test server sets required headers (`Cross-Origin-Opener-Policy`, `Cross-Origin-Embedder-Policy`) for SharedArrayBuffer support
- **SharedArrayBuffer is required** for Quadratic to function properly
- Embedding Quadratic requires the **parent page** (hosting the iframe) to also set these headers
- Most websites cannot/will not set these headers, which limits embeddability
- See `EMBEDDING_SHAREDARRAYBUFFER.md` for detailed information about limitations and potential solutions

## Current Limitations

Quadratic uses `SharedArrayBuffer` for high-performance communication between web workers. This requires:

1. Both the parent page AND the iframe must have:
   - `Cross-Origin-Opener-Policy: same-origin`
   - `Cross-Origin-Embedder-Policy: require-corp`

2. This means Quadratic **cannot be embedded in arbitrary websites** without those headers

3. The parent page hosting the iframe must be configured to set these headers

## See Also

- `EMBEDDING_SHAREDARRAYBUFFER.md` - Detailed documentation about the issue and potential solutions
