# Quadratic MCP Embed Server

A proof-of-concept MCP (Model Context Protocol) server that lets AI assistants interact with an embedded Quadratic spreadsheet. The AI makes tool calls (set cell values, enter formulas, read data) and the commands are relayed to the spreadsheet running in the browser.

## Architecture

```
┌──────────────┐      MCP/SSE       ┌─────────────────┐     WebSocket     ┌──────────────┐   postMessage   ┌─────────────┐
│  AI Client   │ ◄──────────────► │  MCP Embed      │ ◄──────────────► │  Web Page    │ ◄────────────► │  Quadratic  │
│  (Claude,    │                  │  Server         │                  │  (bridge)    │                │  iframe     │
│   ChatGPT)   │                  │  :3300          │                  │              │                │             │
└──────────────┘                  └─────────────────┘                  └──────────────┘                └─────────────┘
```

1. The MCP server exposes spreadsheet tools over SSE transport
2. AI clients connect via SSE and call tools (e.g. `set_cell_value`)
3. The server relays commands to the browser via WebSocket
4. The browser page forwards commands to the Quadratic iframe via `postMessage`
5. The iframe executes the command and sends the result back through the same chain

## Tools

| Tool | Description |
|------|-------------|
| `set_cell_value` | Set a single cell's value (text, number, or formula) |
| `set_cell_values` | Bulk-set a rectangular block of cells |
| `set_code_cell` | Set a code cell (Python, Formula, or Javascript) |
| `get_cell_value` | Read a single cell's current value |
| `get_cell_values` | Read values from a rectangular range |
| `get_sheet_info` | List all sheets in the spreadsheet |

All cell references use **A1 notation** (e.g. `A1`, `C3`, `AA10`).

## Quick Start

```bash
cd mcp-embed-server
npm install
npm run dev
```

Then open [http://localhost:3300](http://localhost:3300) in your browser to see the embedded spreadsheet.

## Connecting an AI Client

### Cursor

Add to your MCP settings (`.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "quadratic-embed": {
      "url": "http://localhost:3300/sse"
    }
  }
}
```

### Claude Desktop

Add to your Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "quadratic-embed": {
      "url": "http://localhost:3300/sse"
    }
  }
}
```

## Configuration

| Environment Variable | Default | Description |
|---------------------|---------|-------------|
| `PORT` | `3300` | HTTP server port |
| `EMBED_URL` | *(preview URL)* | Full iframe embed URL for the Quadratic spreadsheet |

## How It Works (PoC Status)

This PoC sets up the full communication pipeline:

- **Working now**: MCP server with tool definitions, SSE transport, WebSocket bridge, web UI with iframe and log panel
- **Needs iframe support**: The embedded Quadratic iframe needs to add `postMessage` handlers to receive and execute commands. The expected protocol:

### postMessage Protocol (parent → iframe)

```json
{
  "type": "quadratic-mcp-command",
  "id": "req-1",
  "command": "setCellValue",
  "params": { "col": 0, "row": 0, "value": "Hello" }
}
```

### postMessage Protocol (iframe → parent)

```json
{
  "type": "quadratic-mcp-response",
  "id": "req-1",
  "success": true,
  "result": { "value": "Hello" }
}
```

### Readiness handshake (iframe → parent)

```json
{ "type": "quadratic-mcp-ready" }
```
