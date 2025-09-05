import type { Response } from 'express';
import { z } from 'zod';
import type { RequestWithUser } from '../../types/Request';

// ---------- Schemas for expected request ----------

const BaseRpc = {
  jsonrpc: z.literal('2.0'),
  id: z.union([z.string(), z.number()]).optional(),
};

const InitializeSchema = z.object({
  ...BaseRpc,
  method: z.literal('initialize'),
});

const HelloWorldSchema = z.object({
  ...BaseRpc,
  method: z.literal('tools/call'),
  params: z.object({
    name: z.literal('helloWorld'),
    arguments: z.object({
      name: z.string(),
    }),
  }),
});

const CreateSpreadsheetSchema = z.object({
  ...BaseRpc,
  method: z.literal('tools/call'),
  params: z.object({
    name: z.literal('createSpreadsheetFromPromptText'),
    arguments: z.object({
      text: z.string(),
    }),
  }),
});

const RpcRequestSchema = z.union([InitializeSchema, HelloWorldSchema, CreateSpreadsheetSchema]);

type RpcRequest = z.infer<typeof RpcRequestSchema>;

// ---------- Handler ----------

export default [handler];

async function handler(req: RequestWithUser, res: Response) {
  try {
    const parsed = RpcRequestSchema.parse(req.body);

    if (parsed.method === 'initialize') {
      return res.json({
        jsonrpc: '2.0',
        id: parsed.id,
        result: {
          mcpVersion: '2025-06-18',
          serverInfo: { name: 'quadratic-mcp', version: '0.1.0' },
          capabilities: {
            tools: {
              helloWorld: {
                description: 'Get a personalized response from the assistant.',
                inputSchema: {
                  type: 'object',
                  properties: { name: { type: 'string' } },
                  required: ['name'],
                },
              },
              createSpreadsheetFromPromptText: {
                description: 'Create a spreadsheet from a natural language prompt and return its URL.',
                inputSchema: {
                  type: 'object',
                  properties: { text: { type: 'string' } },
                  required: ['text'],
                },
              },
            },
          },
        },
      });
    }

    if (parsed.method === 'tools/call' && parsed.params.name === 'helloWorld') {
      return res.json({
        jsonrpc: '2.0',
        id: parsed.id,
        result: {
          content: [{ type: 'text', text: `Hello, ${parsed.params.arguments.name}!` }],
        },
      });
    }

    if (parsed.method === 'tools/call' && parsed.params.name === 'createSpreadsheetFromPromptText') {
      const url = `http://localhost:3000/files/create?prompt=${encodeURIComponent(parsed.params.arguments.text)}`;
      return res.json({
        jsonrpc: '2.0',
        id: parsed.id,
        result: {
          content: [{ type: 'text', text: `Create your spreadsheet here: ${url}` }],
        },
      });
    }

    // Should be unreachable — anything else fails schema
    throw new Error('Unexpected request');
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.json({
        jsonrpc: '2.0',
        id: req.body?.id,
        error: { code: -32602, message: 'Invalid params', data: err.errors },
      });
    }
    return res.json({
      jsonrpc: '2.0',
      id: req.body?.id,
      error: { code: -32601, message: 'Method not found' },
    });
  }
}
