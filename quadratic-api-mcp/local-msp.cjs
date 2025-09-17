/*
In Claude Desktop config:
/Users/YOU/Library/Application Support/Claude/claude_desktop_config.json

{
  "mcpServers": {
    "quadratic-mcp": {
      "command": "/Users/YOU/n/bin/node",
      "args": [
        "/Users/YOU/quadratic/quadratic-api-mcp/local-msp.cjs"
      ]
    }
  }
}

*/

const readline = require("readline");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

rl.on("line", async (line) => {
  try {
    const message = JSON.parse(line);

    const response = await fetch("http://localhost:8000/mcp", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
      },
      body: JSON.stringify(message),
    });

    const result = await response.text();

    // Handle SSE format if needed
    if (result.startsWith("event: message\ndata: ")) {
      const jsonData = result.split("data: ")[1];
      console.log(jsonData);
    } else {
      console.log(result);
    }
  } catch (error) {
    console.error(
      JSON.stringify({
        jsonrpc: "2.0",
        error: { code: -32603, message: error.message },
        id: null,
      })
    );
  }
});
