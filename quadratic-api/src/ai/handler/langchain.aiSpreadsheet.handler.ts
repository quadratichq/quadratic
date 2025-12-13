import type { Response } from 'express';
import { z } from 'zod';
import { ANTHROPIC_API_KEY } from '../../env-vars';
import logger from '../../utils/logger';

// Tool schemas using Zod (these are lightweight, no langchain dependency)
const AddInputNodeSchema = z.object({
  node_id: z.string().describe('Unique identifier for this node (use snake_case, e.g., "sales_data_input")'),
  label: z.string().describe('Human-readable name displayed on the node'),
  input_type: z
    .enum(['connection', 'file', 'cell', 'data_table', 'web_search', 'html'])
    .describe('Type of input. Use "cell" for single values, "data_table" for multiple rows/columns of data'),
  connection_uuid: z.string().optional().describe('UUID of the database connection (required for connection type)'),
  connection_name: z.string().optional().describe('Name of the connection'),
  connection_type: z.string().optional().describe('Type of database (e.g., POSTGRES, MYSQL)'),
  query: z.string().optional().describe('SQL query to execute (for connection type)'),
  file_name: z.string().optional().describe('Name of the file'),
  file_type: z.string().optional().describe('MIME type of the file'),
  value: z.string().optional().describe('Manual input value (for cell type)'),
  columns: z.array(z.string()).optional().describe('Column names (for data_table type)'),
  rows: z
    .array(z.array(z.string()))
    .optional()
    .describe('Row data as 2D array (for data_table type). Each inner array is one row.'),
  search_query: z.string().optional().describe('Search query for web search'),
  html_content: z.string().optional().describe('HTML content for HTML input'),
});

const AddTransformNodeSchema = z.object({
  node_id: z.string().describe('Unique identifier for this node'),
  label: z.string().describe('Human-readable name displayed on the node'),
  transform_type: z.enum(['code', 'formula']).describe('Type of transformation'),
  language: z.enum(['python', 'javascript']).optional().describe('Programming language (for code type)'),
  code: z.string().optional().describe('The code to execute'),
  formula: z.string().optional().describe('Spreadsheet formula (for formula type)'),
});

const AddOutputNodeSchema = z.object({
  node_id: z.string().describe('Unique identifier for this node'),
  label: z.string().describe('Human-readable name displayed on the node'),
  output_type: z.enum(['table', 'chart', 'html']).describe('Type of output'),
  chart_type: z.enum(['bar', 'line', 'pie', 'scatter']).optional().describe('Type of chart'),
  columns: z.array(z.string()).optional().describe('Expected column names'),
});

const ConnectNodesSchema = z.object({
  source_node_id: z.string().describe('ID of the source node (data flows FROM this node)'),
  target_node_id: z.string().describe('ID of the target node (data flows TO this node)'),
  label: z.string().optional().describe('Optional label for the connection arrow'),
});

const RemoveNodeSchema = z.object({
  node_id: z.string().describe('ID of the node to remove'),
});

const ClearCanvasSchema = z.object({
  confirm: z.boolean().describe('Must be true to confirm clearing all nodes'),
});

const SYSTEM_PROMPT = `You are an AI assistant that builds spreadsheet models visually on a canvas.

## CRITICAL: You must create ALL THREE parts of every model:
1. **INPUT CELLS** - The data/values the user provides
2. **FORMULA/CALCULATION CELLS** - The logic that processes the inputs  
3. **OUTPUT/RESULT CELLS** - Where the final answer is displayed

NEVER stop after creating just inputs. ALWAYS complete the full model with calculations AND results.

## Cell Types

**Input Cells** (add_input_node):
- \`cell\`: A value the user can edit (number, text, etc.)

**Calculation Cells** (add_transform_node):
- \`code\`: Python code for calculations
- \`formula\`: Simple formulas

**Result Cells** (add_output_node):
- \`table\`: Display the result

## Required Workflow

For EVERY request, you MUST:
1. Create input cells for each variable
2. Create a calculation cell with the formula/code
3. Create a result cell to display the answer
4. Connect: inputs → calculation → result

## Example: "Add 5 + 7"

You must create ALL of these:
- add_input_node: cell "a" with value "5"
- add_input_node: cell "b" with value "7"  
- add_transform_node: code that adds the inputs
- add_output_node: table to show the sum
- connect_nodes: a → calculation
- connect_nodes: b → calculation
- connect_nodes: calculation → result

## Example: "Mortgage calculator"

You must create ALL of these:
- add_input_node: cell "home_price" = "500000"
- add_input_node: cell "down_payment_pct" = "20"
- add_input_node: cell "interest_rate" = "6.5"  
- add_input_node: cell "loan_term" = "30"
- add_transform_node: code with PMT calculation
- add_output_node: table for monthly payment
- connect_nodes: (all inputs → calculation → result)

REMEMBER: A model is NOT complete without a calculation cell AND a result cell. Always create the full workflow.`;

interface LangChainAISpreadsheetRequest {
  prompt: string;
  systemPrompt?: string;
  connections?: { uuid: string; name: string; type: string }[];
  signal?: AbortSignal;
}

interface LangChainAISpreadsheetResponse {
  content: string;
  toolCalls: {
    id: string;
    name: string;
    arguments: Record<string, unknown>;
  }[];
}

// Lazy-loaded langchain modules and cached instances
// Using 'any' to avoid TypeScript parsing langchain modules at compile time
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let langchainModules: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let cachedModel: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let cachedTools: any[] | null = null;

// Clear caches to force recreation with new settings
// This is called on module load to ensure we use the latest configuration
cachedModel = null;
cachedTools = null;

async function loadLangchain() {
  if (!langchainModules) {
    // Use require() to completely bypass TypeScript's module resolution
    // This prevents TS from trying to parse langchain types at compile time
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const anthropicModule = require('@langchain/anthropic');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const messagesModule = require('@langchain/core/messages');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const toolsModule = require('@langchain/core/tools');

    langchainModules = {
      ChatAnthropic: anthropicModule.ChatAnthropic,
      HumanMessage: messagesModule.HumanMessage,
      SystemMessage: messagesModule.SystemMessage,
      AIMessage: messagesModule.AIMessage,
      ToolMessage: messagesModule.ToolMessage,
      tool: toolsModule.tool,
    };
  }
  return langchainModules;
}

async function getTools() {
  if (cachedTools) return cachedTools;

  const { tool } = await loadLangchain();

  const addInputNode = tool(
    async (input: z.infer<typeof AddInputNodeSchema>) => {
      return JSON.stringify({ success: true, action: 'add_input_node', ...input });
    },
    {
      name: 'add_input_node',
      description:
        'Add an input node to the canvas. Input nodes are data sources like database connections, files, manual values, web searches, or HTML content.',
      schema: AddInputNodeSchema,
    }
  );

  const addTransformNode = tool(
    async (input: z.infer<typeof AddTransformNodeSchema>) => {
      return JSON.stringify({ success: true, action: 'add_transform_node', ...input });
    },
    {
      name: 'add_transform_node',
      description:
        'Add a transform node that processes data. Use code (Python/JavaScript) for complex transformations or formulas for simple calculations.',
      schema: AddTransformNodeSchema,
    }
  );

  const addOutputNode = tool(
    async (input: z.infer<typeof AddOutputNodeSchema>) => {
      return JSON.stringify({ success: true, action: 'add_output_node', ...input });
    },
    {
      name: 'add_output_node',
      description: 'Add an output node to display results. Can be a data table, chart visualization, or custom HTML.',
      schema: AddOutputNodeSchema,
    }
  );

  const connectNodes = tool(
    async (input: z.infer<typeof ConnectNodesSchema>) => {
      return JSON.stringify({ success: true, action: 'connect_nodes', ...input });
    },
    {
      name: 'connect_nodes',
      description: 'Connect two nodes with an arrow showing data flow. Data flows from source to target.',
      schema: ConnectNodesSchema,
    }
  );

  const removeNode = tool(
    async (input: z.infer<typeof RemoveNodeSchema>) => {
      return JSON.stringify({ success: true, action: 'remove_node', ...input });
    },
    {
      name: 'remove_node',
      description: 'Remove a node from the canvas. Also removes any connections to/from this node.',
      schema: RemoveNodeSchema,
    }
  );

  const clearCanvas = tool(
    async (input: z.infer<typeof ClearCanvasSchema>) => {
      return JSON.stringify({ success: true, action: 'clear_canvas', ...input });
    },
    {
      name: 'clear_canvas',
      description: 'Clear all nodes and connections from the canvas. Use when the user wants to start over.',
      schema: ClearCanvasSchema,
    }
  );

  cachedTools = [addInputNode, addTransformNode, addOutputNode, connectNodes, removeNode, clearCanvas];
  return cachedTools;
}

async function getModel() {
  if (cachedModel) return cachedModel;

  const { ChatAnthropic } = await loadLangchain();

  cachedModel = new ChatAnthropic({
    model: 'claude-opus-4-5',
    apiKey: ANTHROPIC_API_KEY,
    temperature: 0,
    streaming: true,
    maxTokens: 8192, // Ensure enough tokens for complete workflows with many tool calls
  });

  return cachedModel;
}

export async function handleLangChainAISpreadsheetRequest(
  request: LangChainAISpreadsheetRequest,
  response: Response
): Promise<void> {
  const { prompt, systemPrompt, connections, signal } = request;

  // Build system message with connections context
  let fullSystemPrompt = systemPrompt || SYSTEM_PROMPT;
  if (connections && connections.length > 0) {
    const connList = connections.map((c) => `- ${c.name} (${c.type}): UUID = "${c.uuid}"`).join('\n');
    fullSystemPrompt += `\n\nAvailable database connections:\n${connList}`;
  }

  // Log what we're sending to the model
  logger.info('[LangChain AI Spreadsheet] Request details:', {
    promptLength: prompt.length,
    promptPreview: prompt.substring(0, 500),
    systemPromptLength: fullSystemPrompt.length,
    hasConnections: connections && connections.length > 0,
  });

  // Dynamically load langchain modules (deferred to first request)
  const { HumanMessage, SystemMessage } = await loadLangchain();
  const tools = await getTools();
  const baseModel = await getModel();

  // Bind tools to model (returns a new instance, so this is safe)
  const model = baseModel.bindTools(tools);

  // Build messages - we'll add to this as we loop
  const messages: any[] = [new SystemMessage(fullSystemPrompt), new HumanMessage(prompt)];

  // Set up SSE headers
  response.setHeader('Content-Type', 'text/event-stream');
  response.setHeader('Cache-Control', 'no-cache');
  response.setHeader('Connection', 'keep-alive');

  // Load ToolMessage class for sending tool results
  const { ToolMessage, AIMessage } = await loadLangchain();

  try {
    let allToolCalls: LangChainAISpreadsheetResponse['toolCalls'] = [];
    let allContent = '';
    let loopCount = 0;
    const MAX_LOOPS = 5; // Prevent infinite loops

    // Agentic loop - continue until model stops making tool calls
    while (loopCount < MAX_LOOPS) {
      loopCount++;
      logger.info('[LangChain AI Spreadsheet] Starting loop iteration', { loopCount });

      let accumulatedContent = '';
      let toolCalls: LangChainAISpreadsheetResponse['toolCalls'] = [];
      let toolCallIndex = 0;
      // Track streaming tool call chunks by index (for accumulating partial JSON args)
      const streamingToolCalls: Map<number, { id?: string; name?: string; argsStr: string }> = new Map();

      // Stream the response
      const stream = await model.stream(messages, {
        signal,
      });

      let chunkNumber = 0;
      let lastChunk: any = null;
      for await (const chunk of stream) {
        chunkNumber++;
        lastChunk = chunk;
        if (signal?.aborted) {
          logger.info('[LangChain AI Spreadsheet] Stream aborted by signal at chunk:', { chunkNumber });
          break;
        }

        // Debug: log the raw chunk structure for tool calls
        if (chunk.tool_calls && chunk.tool_calls.length > 0) {
          logger.info('[LangChain AI Spreadsheet] Raw tool_calls from chunk:', {
            toolCalls: chunk.tool_calls.map(
              (tc: { id?: string; name?: string; args?: unknown; arguments?: unknown }) => ({
                id: tc.id,
                name: tc.name,
                args: tc.args,
                arguments: tc.arguments,
                argsType: typeof tc.args,
                argumentsType: typeof tc.arguments,
                argsKeys: tc.args && typeof tc.args === 'object' ? Object.keys(tc.args as object) : [],
                argumentsKeys:
                  tc.arguments && typeof tc.arguments === 'object' ? Object.keys(tc.arguments as object) : [],
              })
            ),
          });
        }
        // Also check for tool_call_chunks (used in streaming mode)
        if (chunk.tool_call_chunks && chunk.tool_call_chunks.length > 0) {
          logger.info('[LangChain AI Spreadsheet] Raw tool_call_chunks from chunk:', {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            toolCallChunks: chunk.tool_call_chunks.map((tc: any) => ({
              id: tc.id,
              index: tc.index,
              name: tc.name,
              args: tc.args,
            })),
          });
        }

        // Extract content from the chunk
        if (chunk.content) {
          if (typeof chunk.content === 'string') {
            accumulatedContent += chunk.content;
          } else if (Array.isArray(chunk.content)) {
            for (const block of chunk.content) {
              if (typeof block === 'string') {
                accumulatedContent += block;
              } else if (block.type === 'text') {
                accumulatedContent += block.text;
              }
            }
          }
        }

        // Handle tool_call_chunks (streaming mode) - accumulate partial JSON args
        if (chunk.tool_call_chunks && chunk.tool_call_chunks.length > 0) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          for (const tc of chunk.tool_call_chunks as any[]) {
            const index = tc.index ?? 0;
            const existing = streamingToolCalls.get(index) || { argsStr: '' };

            // Update name and id if provided
            if (tc.name) existing.name = tc.name;
            if (tc.id) existing.id = tc.id;
            // Accumulate args string (it comes in chunks)
            if (tc.args) existing.argsStr += tc.args;

            streamingToolCalls.set(index, existing);
          }

          // Try to parse completed tool calls and add to toolCalls array
          for (const [index, stc] of streamingToolCalls.entries()) {
            if (stc.name && stc.argsStr) {
              try {
                const parsedArgs = JSON.parse(stc.argsStr);
                // Use a composite key for finding existing entries: prefer id, fallback to index
                const toolId = stc.id || `tool_${index}`;
                const existingIndex = toolCalls.findIndex((t) => t.id === toolId);
                if (existingIndex >= 0) {
                  // Update existing entry with parsed args
                  toolCalls[existingIndex] = {
                    id: toolId,
                    name: stc.name,
                    arguments: parsedArgs as Record<string, unknown>,
                  };
                } else {
                  // Add new tool call
                  toolCalls.push({
                    id: toolId,
                    name: stc.name,
                    arguments: parsedArgs as Record<string, unknown>,
                  });
                }
              } catch {
                // JSON not complete yet, continue accumulating
              }
            }
          }
        }

        // Extract tool calls from the chunk (complete tool calls, non-streaming format)
        if (chunk.tool_calls && chunk.tool_calls.length > 0) {
          for (const tc of chunk.tool_calls) {
            if (!tc.name) continue; // Skip incomplete tool calls
            // LangChain may use either 'args' or 'arguments' depending on version
            const newArgs = (tc.args ?? tc.arguments ?? {}) as Record<string, unknown>;
            // Only process if we have actual arguments
            if (Object.keys(newArgs).length > 0) {
              const existingIndex = toolCalls.findIndex((t) => t.id === tc.id);
              if (existingIndex >= 0) {
                // MERGE arguments instead of replacing - streaming may send partial updates
                const existingArgs = toolCalls[existingIndex].arguments;
                toolCalls[existingIndex] = {
                  id: tc.id || `tool_${toolCallIndex++}`,
                  name: tc.name,
                  arguments: { ...existingArgs, ...newArgs } as Record<string, unknown>,
                };
              } else {
                toolCalls.push({
                  id: tc.id || `tool_${toolCallIndex++}`,
                  name: tc.name,
                  arguments: newArgs as Record<string, unknown>,
                });
              }
            }
          }
        }

        // Send SSE update (only if response is still writable)
        // Only send tool calls that have non-empty arguments
        if (!response.writableEnded) {
          const validToolCalls = toolCalls.filter((tc) => Object.keys(tc.arguments).length > 0);
          const sseData = {
            role: 'assistant',
            content: [{ type: 'text', text: accumulatedContent }],
            toolCalls: validToolCalls.map((tc) => ({
              id: tc.id,
              name: tc.name,
              arguments: tc.arguments,
            })),
            isOnPaidPlan: true,
            exceededBillingLimit: false,
          };

          response.write(`data: ${JSON.stringify(sseData)}\n\n`);
        }
      }

      // Log detailed info about what we received from the stream
      const streamingToolCallsSummary = Array.from(streamingToolCalls.entries()).map(([index, stc]) => ({
        index,
        name: stc.name,
        id: stc.id,
        argsLength: stc.argsStr.length,
        argsPreview: stc.argsStr.substring(0, 100),
      }));

      // Check for stop reason in the last chunk
      const stopReason = lastChunk?.response_metadata?.stop_reason || lastChunk?.usage_metadata?.stop_reason;
      const usageMetadata = lastChunk?.usage_metadata;

      logger.info('[LangChain AI Spreadsheet] Stream iteration ended', {
        loopCount,
        chunkNumber,
        signalAborted: signal?.aborted,
        responseWritableEnded: response.writableEnded,
        streamingToolCallsCount: streamingToolCalls.size,
        streamingToolCallsSummary,
        toolCallsCount: toolCalls.length,
        toolCallNames: toolCalls.map((tc) => tc.name),
        stopReason,
        usageMetadata: usageMetadata
          ? {
              input_tokens: usageMetadata.input_tokens,
              output_tokens: usageMetadata.output_tokens,
            }
          : undefined,
      });

      // Accumulate content and tool calls across iterations
      allContent += accumulatedContent;
      const validToolCalls = toolCalls.filter((tc) => Object.keys(tc.arguments).length > 0);
      allToolCalls = [...allToolCalls, ...validToolCalls];

      // Send SSE update with current tool calls (not final yet if we're continuing)
      if (!response.writableEnded && validToolCalls.length > 0) {
        const sseData = {
          role: 'assistant',
          content: [{ type: 'text', text: allContent }],
          toolCalls: allToolCalls.map((tc) => ({
            id: tc.id,
            name: tc.name,
            arguments: tc.arguments,
          })),
          isOnPaidPlan: true,
          exceededBillingLimit: false,
        };
        response.write(`data: ${JSON.stringify(sseData)}\n\n`);
      }

      // If there are tool calls, we need to continue the loop by sending tool results
      if (validToolCalls.length > 0) {
        logger.info('[LangChain AI Spreadsheet] Tool calls found, adding to messages for continuation', {
          toolCallCount: validToolCalls.length,
        });

        // Add the AI's response (with tool calls) to messages
        const aiMessageContent = accumulatedContent || '';
        const aiToolCalls = validToolCalls.map((tc) => ({
          id: tc.id,
          name: tc.name,
          args: tc.arguments,
        }));

        // Create AI message with tool calls
        const aiMessage = new AIMessage({
          content: aiMessageContent,
          tool_calls: aiToolCalls,
        });
        messages.push(aiMessage);

        // Add tool result messages for each tool call
        for (const tc of validToolCalls) {
          const toolResultMessage = new ToolMessage({
            tool_call_id: tc.id,
            content: `Created ${tc.name.replace('add_', '').replace('_node', ' cell').replace('_', ' ')}: ${tc.arguments.label || tc.arguments.node_id || 'success'}`,
          });
          messages.push(toolResultMessage);
        }

        // Continue the loop
        continue;
      }

      // No tool calls, we're done - break out of the loop
      logger.info('[LangChain AI Spreadsheet] No more tool calls, finishing');
      break;
    } // End of while loop

    // Send final message (only if response is still writable)
    if (!response.writableEnded) {
      logger.info('[LangChain AI Spreadsheet] Final tool calls:', {
        total: allToolCalls.length,
        toolCalls: allToolCalls.map((tc) => ({
          id: tc.id,
          name: tc.name,
          argsKeys: Object.keys(tc.arguments),
        })),
      });

      const finalData = {
        role: 'assistant',
        content: [{ type: 'text', text: allContent }],
        toolCalls: allToolCalls.map((tc) => ({
          id: tc.id,
          name: tc.name,
          arguments: tc.arguments,
        })),
        isOnPaidPlan: true,
        exceededBillingLimit: false,
        done: true,
      };

      response.write(`data: ${JSON.stringify(finalData)}\n\n`);
      response.end();
    }

    logger.info('[LangChain AI Spreadsheet] Request completed', {
      totalLoops: loopCount,
      toolCallCount: allToolCalls.length,
      contentLength: allContent.length,
    });
  } catch (error) {
    if (signal?.aborted) {
      logger.info('[LangChain AI Spreadsheet] Request aborted by client');
      if (!response.writableEnded) {
        response.end();
      }
      return;
    }

    logger.error('[LangChain AI Spreadsheet] Error processing request', error);

    // Send error response
    if (!response.writableEnded) {
      const errorData = {
        role: 'assistant',
        content: [{ type: 'text', text: 'AI connection error. Please try again.' }],
        toolCalls: [],
        isOnPaidPlan: true,
        exceededBillingLimit: false,
        error: true,
      };

      if (!response.headersSent) {
        response.setHeader('Content-Type', 'text/event-stream');
      }
      response.write(`data: ${JSON.stringify(errorData)}\n\n`);
      response.end();
    }
  }
}
