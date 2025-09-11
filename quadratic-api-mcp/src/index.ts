import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// Create server instance
const server = new McpServer({
  name: "quadratic-mcp",
  version: "0.1.0",
});

// Register tools
server.tool(
  "createSpreadsheetFromPromptText",
  "Create a spreadsheet from a natural language prompt and return its URL.",
  {
    text: z
      .string()
      .describe(
        "Natural language prompt describing what spreadsheet to create",
      ),
  },
  async ({ text }) => {
    const url = `http://localhost:3000/files/create?prompt=${encodeURIComponent(text)}`;
    return {
      content: [
        {
          type: "text",
          text: `Create your by this link to your spreadsheet: ${url}`,
        },
      ],
    };
  },
);

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Quadratic MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
