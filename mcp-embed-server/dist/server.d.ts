import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
/**
 * Creates an MCP server with all Quadratic tools registered as MCP App tools.
 * Each tool links to the Quadratic spreadsheet UI resource so the host
 * renders the spreadsheet inline when any tool is called.
 */
export declare function createServer(): McpServer;
