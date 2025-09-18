// Add this to your existing app.ts file after your other imports
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { Request, Response } from 'express';
import { Router } from 'express';
import { z } from 'zod';
import { AUTH_CORS } from './env-vars';
import logger from './utils/logger';

const mcpRouter = Router();

// Extract your MCP server configuration into a reusable function
function getServer(): McpServer {
  // Create server instance
  const server = new McpServer({
    name: 'quadratic-mcp',
    version: '0.1.0',
  });

  // Register tools
  server.tool(
    'start a spreadsheet from a prompt',
    'Start a new spreadsheet from a natural language prompt and return its URL. The assistant should immediately display the returned URL prominently to the user.',
    {
      text: z.string().describe('Natural language prompt describing what spreadsheet to create'),
    },
    async ({ text }) => {
      const url = `${AUTH_CORS}/files/create?prompt=${encodeURIComponent(text)}`;
      return {
        content: [
          {
            type: 'text',
            text: `Spreadsheet link: ${url}`,
          },
        ],
      };
    }
  );

  return server;
}

// Add these routes to your existing app.ts file, before the registerRoutes() call

// MCP POST route for handling MCP requests
mcpRouter.post('/', async (req: Request, res: Response) => {
  // In stateless mode, create a new instance of transport and server for each request
  // to ensure complete isolation. A single instance would cause request ID collisions
  // when multiple clients connect concurrently.

  try {
    const server = getServer();
    const transport: StreamableHTTPServerTransport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });

    res.on('close', () => {
      logger.info('MCP request closed');
      transport.close();
      server.close();
    });

    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    logger.error('Error handling MCP request:', error);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: '2.0',
        error: {
          code: -32603,
          message: 'Internal server error',
        },
        id: null,
      });
    }
  }
});

// SSE notifications not supported in stateless mode
mcpRouter.get('/', async (req: Request, res: Response) => {
  logger.info('Received GET MCP request - method not allowed');
  res.status(405).json({
    jsonrpc: '2.0',
    error: {
      code: -32000,
      message: 'Method not allowed.',
    },
    id: null,
  });
});

// Session termination not needed in stateless mode
mcpRouter.delete('/', async (req: Request, res: Response) => {
  logger.info('Received DELETE MCP request - method not allowed');
  res.status(405).json({
    jsonrpc: '2.0',
    error: {
      code: -32000,
      message: 'Method not allowed.',
    },
    id: null,
  });
});

// Your existing registerRoutes() call and error handling middleware remain the same

export default mcpRouter;
