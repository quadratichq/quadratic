# Quadratic Embedding Tests

This directory contains tools for testing Quadratic's embeddability in other web pages.

## Files

- **`test-embed.html`** - Test page for embedding Quadratic spreadsheets in an iframe
- **`test-embed.css`** - Styles for the test page
- **`test-embed.js`** - JavaScript for the test page
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

### Embed URL Formats

The test page supports three embed URL formats:

1. **embedId** - Load a Quadratic file by its embed ID (file must be shared publicly):
   ```
   http://localhost:3000/embed?embedId=xxx
   https://app.quadratichq.com/embed?embedId=xxx
   ```

2. **import** - Import a file from a URL (e.g., Excel, CSV):
   ```
   http://localhost:3000/embed?import=https://example.com/file.xlsx
   https://app.quadratichq.com/embed?import=https://example.com/data.csv
   ```

3. **blank** - Open a new blank spreadsheet (no parameters needed):
   ```
   http://localhost:3000/embed
   https://app.quadratichq.com/embed
   ```

### URL Parameters

The following URL parameters can be set via the UI or added manually:

| Parameter | Description | Example |
|-----------|-------------|---------|
| `embedId` | UUID of an embed link to load | `embedId=abc123` |
| `import` | URL of a file to import | `import=https://example.com/file.xlsx` |
| `preload` | Comma-separated list of kernels to preload | `preload=python,js` |
| `readonly` | Make the embed read-only (no value needed) | `readonly` |
| `sheet` | Name of the sheet to display | `sheet=Sheet1` |

### Test Page Features

- **URL History** - Previously loaded URLs are saved and shown in a dropdown
- **Preload Python** - Preload the Python kernel for faster code execution
- **Preload JavaScript** - Preload the JavaScript kernel for faster code execution
- **Read-only** - Load the embed in read-only mode (no editing)
- **Sheet name** - Jump to a specific sheet by name
- **Copy URL** - Copy the current embed URL with all parameters to clipboard
- **Auto-reload** - Changing any flag automatically reloads the embed
- **Persistent settings** - Your last URL and settings are saved to localStorage
