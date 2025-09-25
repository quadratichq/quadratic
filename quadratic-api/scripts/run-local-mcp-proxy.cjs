/*

Make sure the API server is running with `npm run dev`

Then in your Claude Desktop config:

`/Users/YOU/Library/Application Support/Claude/claude_desktop_config.json`

```
{
  "mcpServers": {
    "quadratic-mcp": {
      "command": "/Users/YOU/path/to/your/node",
      "args": [
        "/Users/YOU/path/to/quadratic/quadratic-api/scripts/run-local-mcp-proxy.cjs"
      ]
    }
  }
}
```
*/

const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

rl.on('line', async (line) => {
  try {
    const message = JSON.parse(line);

    const response = await fetch('http://localhost:8000/mcp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
      },
      body: JSON.stringify(message),
    });

    const result = await response.text();

    // Handle SSE format if needed
    if (result.includes('data: ')) {
      // Split by double newlines to separate events
      const events = result.split('\n\n').filter((event) => event.trim());

      for (const event of events) {
        const lines = event.split('\n');
        let eventData = '';

        // Concatenate all data fields for this event
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            eventData += (eventData ? '\n' : '') + line.substring(6);
          }
        }

        if (eventData) {
          console.log(eventData);
        }
      }
    } else {
      console.log(result);
    }
  } catch (error) {
    console.error(
      JSON.stringify({
        jsonrpc: '2.0',
        error: { code: -32603, message: error.message },
        id: null,
      })
    );
  }
});
