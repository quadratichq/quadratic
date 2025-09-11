# Simple Server For Testing Locally

To test the server locally with Claude Desktop:

First, build the project:

```
npm run build
```

Then setup your Claude Desktop config to point at this server's build file (Settings > Developer > Edit Config). 

```json
{
  "mcpServers": {
    "quadratic-local": {
      "command": "/path/to/your/node",
      "args": [
        "/Users/You/quadratic/quadratic-api-mcp/build/index.js"
      ]
    }
  }
}
```

Quit and restart Claude. You should now see "quadratic-local"