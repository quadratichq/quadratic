import {
  AI_SPREADSHEET_SYSTEM_PROMPT,
  AiSpreadsheetTool,
  AiSpreadsheetToolsArgsSchema,
} from '@/aiSpreadsheet/ai/aiSpreadsheetToolsSpec';
import {
  addNode,
  aiSpreadsheetAtom,
  clearCanvas,
  connectNodes,
  removeNode,
  type AiSpreadsheetState,
} from '@/aiSpreadsheet/atoms/aiSpreadsheetAtom';
import { executePython, type InputValues } from '@/aiSpreadsheet/execution/pythonRunner';
import type {
  AddNodeArgs,
  AiNodeType,
  AiSpreadsheetNode,
  BaseInputNodeData,
  CodeExecutionResult,
  CodeNodeData,
} from '@/aiSpreadsheet/types';
import { authClient } from '@/auth/auth';
import { apiClient } from '@/shared/api/apiClient';
import { useCallback, useRef } from 'react';
import { useRecoilState } from 'recoil';

/**
 * Execute a code node and return the result
 */
async function executeCodeNodeAndGetResult(
  nodeId: string,
  nodes: AiSpreadsheetNode[],
  edges: { source: string; target: string }[]
): Promise<{ nodeId: string; result: CodeExecutionResult; codeData: CodeNodeData } | null> {
  const node = nodes.find((n) => n.id === nodeId);
  if (!node || node.data.nodeType !== 'code') return null;

  const codeData = node.data as CodeNodeData;
  if (codeData.language !== 'python') return null;

  // Get input dependencies
  const incomingEdges = edges.filter((e) => e.target === nodeId);
  const sourceNodeIds = incomingEdges.map((e) => e.source);
  const inputNodes = nodes.filter((n) => sourceNodeIds.includes(n.id) && n.data.category === 'input');

  // Build input values
  const inputValues: InputValues = new Map();
  for (const inputNode of inputNodes) {
    const data = inputNode.data as BaseInputNodeData;
    const name = data.name;
    if (!name) continue;

    switch (data.nodeType) {
      case 'cell':
        inputValues.set(name, (data as BaseInputNodeData & { value: string }).value || '');
        break;
      case 'dataTable': {
        const tableData = data as BaseInputNodeData & { columns: string[]; rows: string[][] };
        const tableArray = [tableData.columns, ...tableData.rows];
        inputValues.set(name, tableArray);
        break;
      }
    }
  }

  try {
    const result = await executePython(codeData.code, inputValues);
    return { nodeId, result, codeData };
  } catch (error) {
    return {
      nodeId,
      result: {
        type: 'error',
        error: error instanceof Error ? error.message : String(error),
        executedAt: Date.now(),
      },
      codeData,
    };
  }
}

interface Connection {
  uuid: string;
  name: string;
  type: string;
}

interface ToolCall {
  id: string;
  name: string;
  arguments: string;
}

export function useAiSpreadsheetTools() {
  const [state, setState] = useRecoilState(aiSpreadsheetAtom);
  const abortControllerRef = useRef<AbortController | null>(null);
  const nodeIdMapRef = useRef<Map<string, string>>(new Map());

  // Process a single tool call and update state
  const processToolCall = useCallback((toolCall: ToolCall, currentState: AiSpreadsheetState): AiSpreadsheetState => {
    try {
      const args = JSON.parse(toolCall.arguments);

      switch (toolCall.name) {
        case AiSpreadsheetTool.AddInputNode: {
          const parseResult = AiSpreadsheetToolsArgsSchema[AiSpreadsheetTool.AddInputNode].safeParse(args);
          if (!parseResult.success) {
            console.warn('[AI Spreadsheet] Skipping incomplete tool call:', toolCall.name, parseResult.error.issues);
            return currentState;
          }
          const parsed = parseResult.data;
          const nodeType = mapInputType(parsed.input_type);
          const result = addNode(currentState, {
            nodeType,
            label: parsed.label,
            data: buildInputNodeData(parsed),
          });
          // Map the AI's node_id to the actual UUID
          nodeIdMapRef.current.set(parsed.node_id, result.newNodeId);
          return { ...currentState, nodes: result.nodes };
        }

        case AiSpreadsheetTool.AddTransformNode: {
          const parseResult = AiSpreadsheetToolsArgsSchema[AiSpreadsheetTool.AddTransformNode].safeParse(args);
          if (!parseResult.success) {
            console.warn('[AI Spreadsheet] Skipping incomplete tool call:', toolCall.name, parseResult.error.issues);
            return currentState;
          }
          const parsed = parseResult.data;
          const nodeType: AiNodeType = parsed.transform_type === 'code' ? 'code' : 'formula';
          const result = addNode(currentState, {
            nodeType,
            label: parsed.label,
            data:
              nodeType === 'code'
                ? { language: parsed.language || 'python', code: parsed.code || '', description: parsed.description }
                : { formula: parsed.formula || '' },
          });
          nodeIdMapRef.current.set(parsed.node_id, result.newNodeId);
          return { ...currentState, nodes: result.nodes };
        }

        case AiSpreadsheetTool.AddOutputNode: {
          const parseResult = AiSpreadsheetToolsArgsSchema[AiSpreadsheetTool.AddOutputNode].safeParse(args);
          if (!parseResult.success) {
            console.warn('[AI Spreadsheet] Skipping incomplete tool call:', toolCall.name, parseResult.error.issues);
            return currentState;
          }
          const parsed = parseResult.data;
          const nodeType = mapOutputType(parsed.output_type);
          const result = addNode(currentState, {
            nodeType,
            label: parsed.label,
            data: buildOutputNodeData(parsed),
          });
          nodeIdMapRef.current.set(parsed.node_id, result.newNodeId);
          return { ...currentState, nodes: result.nodes };
        }

        case AiSpreadsheetTool.ConnectNodes: {
          const parseResult = AiSpreadsheetToolsArgsSchema[AiSpreadsheetTool.ConnectNodes].safeParse(args);
          if (!parseResult.success) {
            console.warn('[AI Spreadsheet] Skipping incomplete tool call:', toolCall.name, parseResult.error.issues);
            return currentState;
          }
          const parsed = parseResult.data;

          // Try to get source and target IDs from mapping, or find by label/name
          let sourceId = nodeIdMapRef.current.get(parsed.source_node_id);
          let targetId = nodeIdMapRef.current.get(parsed.target_node_id);

          // Fallback: find by label or name if not in map
          if (!sourceId) {
            const sourceNode = currentState.nodes.find(
              (n) =>
                n.data.label?.toLowerCase() === parsed.source_node_id.toLowerCase() ||
                (n.data as BaseInputNodeData).name?.toLowerCase() === parsed.source_node_id.toLowerCase()
            );
            if (sourceNode) sourceId = sourceNode.id;
          }
          if (!targetId) {
            const targetNode = currentState.nodes.find(
              (n) =>
                n.data.label?.toLowerCase() === parsed.target_node_id.toLowerCase() ||
                (n.data as BaseInputNodeData).name?.toLowerCase() === parsed.target_node_id.toLowerCase()
            );
            if (targetNode) targetId = targetNode.id;
          }

          if (sourceId && targetId) {
            const result = connectNodes(currentState, {
              sourceNodeId: sourceId,
              targetNodeId: targetId,
              label: parsed.label,
            });
            return { ...currentState, edges: result.edges };
          } else {
            console.warn('[AI Spreadsheet] Could not find nodes to connect:', {
              source: parsed.source_node_id,
              target: parsed.target_node_id,
              foundSource: sourceId,
              foundTarget: targetId,
            });
          }
          return currentState;
        }

        case AiSpreadsheetTool.RemoveNode: {
          const parseResult = AiSpreadsheetToolsArgsSchema[AiSpreadsheetTool.RemoveNode].safeParse(args);
          if (!parseResult.success) {
            console.warn('[AI Spreadsheet] Skipping incomplete tool call:', toolCall.name, parseResult.error.issues);
            return currentState;
          }
          const parsed = parseResult.data;
          const nodeId = nodeIdMapRef.current.get(parsed.node_id);
          console.log('[AI Spreadsheet] RemoveNode:', {
            requestedNodeId: parsed.node_id,
            mappedNodeId: nodeId,
            availableMappings: Array.from(nodeIdMapRef.current.entries()),
            existingNodeIds: currentState.nodes.map((n) => n.id),
          });
          if (nodeId) {
            return removeNode(currentState, { nodeId });
          } else {
            // Try to find node by label if AI used label instead of node_id
            const nodeByLabel = currentState.nodes.find(
              (n) => n.data.label?.toLowerCase() === parsed.node_id.toLowerCase()
            );
            if (nodeByLabel) {
              console.log('[AI Spreadsheet] Found node by label:', nodeByLabel.id);
              return removeNode(currentState, { nodeId: nodeByLabel.id });
            }
            console.warn('[AI Spreadsheet] Could not find node to remove:', parsed.node_id);
          }
          return currentState;
        }

        case AiSpreadsheetTool.UpdateNode: {
          const parseResult = AiSpreadsheetToolsArgsSchema[AiSpreadsheetTool.UpdateNode].safeParse(args);
          if (!parseResult.success) {
            console.warn('[AI Spreadsheet] Skipping incomplete tool call:', toolCall.name, parseResult.error.issues);
            return currentState;
          }
          const parsed = parseResult.data;

          // Find the node by ID or label
          let nodeId = nodeIdMapRef.current.get(parsed.node_id);
          if (!nodeId) {
            const nodeByLabel = currentState.nodes.find(
              (n) => n.data.label?.toLowerCase() === parsed.node_id.toLowerCase()
            );
            if (nodeByLabel) nodeId = nodeByLabel.id;
          }

          if (!nodeId) {
            console.warn('[AI Spreadsheet] Could not find node to update:', parsed.node_id);
            return currentState;
          }

          console.log('[AI Spreadsheet] Updating node:', nodeId, parsed);

          // Update the node with the provided fields
          return {
            ...currentState,
            nodes: currentState.nodes.map((n) => {
              if (n.id !== nodeId) return n;

              const updatedData = { ...n.data };

              // Update common fields
              if (parsed.label) updatedData.label = parsed.label;

              // Update code-specific fields
              if (n.data.nodeType === 'code') {
                if (parsed.code !== undefined) (updatedData as CodeNodeData).code = parsed.code;
                if (parsed.description !== undefined) (updatedData as CodeNodeData).description = parsed.description;
                // Reset execution state when code changes
                if (parsed.code !== undefined) {
                  (updatedData as CodeNodeData).executionState = undefined;
                  (updatedData as CodeNodeData).result = undefined;
                }
              }

              // Update input cell value
              if (n.data.nodeType === 'cell' && parsed.value !== undefined) {
                (updatedData as BaseInputNodeData & { value: string }).value = parsed.value;
              }

              return { ...n, data: updatedData };
            }),
          };
        }

        case AiSpreadsheetTool.ClearCanvas: {
          const parseResult = AiSpreadsheetToolsArgsSchema[AiSpreadsheetTool.ClearCanvas].safeParse(args);
          if (!parseResult.success) {
            console.warn('[AI Spreadsheet] Skipping incomplete tool call:', toolCall.name, parseResult.error.issues);
            return currentState;
          }
          const parsed = parseResult.data;
          if (parsed.confirm) {
            nodeIdMapRef.current.clear();
            return { ...currentState, ...clearCanvas() };
          }
          return currentState;
        }

        default:
          console.warn('Unknown tool call:', toolCall.name);
          return currentState;
      }
    } catch (error) {
      console.error('Error processing tool call:', error, toolCall);
      return currentState;
    }
  }, []);

  // Internal function to process AI response with recursion support
  const processAiResponseInternal = useCallback(
    async (userMessage: string, connections: Connection[], recursionDepth: number = 0) => {
      // Limit recursion to prevent infinite loops (max 3 attempts to fix errors)
      if (recursionDepth > 2) {
        console.warn('[AI Spreadsheet] Max recursion depth reached, stopping error correction');
        setState((prev) => ({ ...prev, loading: false }));
        return;
      }

      // Only cancel and reset on first call (not recursive error fixes)
      if (recursionDepth === 0) {
        abortControllerRef.current?.abort();
        abortControllerRef.current = new AbortController();

        // Reset streaming state
        setState((prev) => ({
          ...prev,
          streamingContent: '',
          streamingToolCalls: [],
        }));
      }

      try {
        const token = await authClient.getTokenOrRedirect();
        const endpoint = `${apiClient.getApiUrl()}/v0/ai/spreadsheet`;

        // Build the full prompt with chat history context
        const chatHistory = state.chatMessages
          .map((msg) => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`)
          .join('\n\n');

        const fullPrompt = chatHistory ? `${chatHistory}\n\nUser: ${userMessage}` : userMessage;

        const response = await fetch(endpoint, {
          method: 'POST',
          signal: abortControllerRef.current?.signal,
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            teamUuid: state.teamUuid,
            prompt: fullPrompt,
            systemPrompt: AI_SPREADSHEET_SYSTEM_PROMPT,
            connections: connections.map((c) => ({
              uuid: c.uuid,
              name: c.name,
              type: c.type,
            })),
          }),
        });

        if (!response.ok) {
          throw new Error(`API error: ${response.status}`);
        }

        // Process streaming response
        const reader = response.body?.getReader();
        if (!reader) throw new Error('No response body');

        console.log('[AI Spreadsheet] Starting to read stream...');

        const decoder = new TextDecoder();
        let assistantMessage = '';
        let toolCalls: ToolCall[] = [];
        let buffer = '';
        let chunkCount = 0;

        // Track which tool calls have been processed to avoid duplicates
        const processedToolCallIds = new Set<string>();

        // Helper to update streaming state AND process new tool calls immediately
        const updateStreamingState = (content: string, tools: ToolCall[]) => {
          setState((prev) => {
            // Start with previous state
            let currentState = { ...prev, streamingContent: content };

            // Build streaming tool calls with processed status
            let streamingToolCalls = tools.map((tc) => ({
              ...tc,
              processed: processedToolCallIds.has(tc.id),
            }));

            // Process any NEW tool calls immediately (render cells as they come in)
            for (const toolCall of tools) {
              if (!processedToolCallIds.has(toolCall.id)) {
                console.log('[AI Spreadsheet] Processing tool call immediately:', toolCall.name);
                processedToolCallIds.add(toolCall.id);
                currentState = processToolCall(toolCall, currentState);
                // Mark this tool call as processed
                streamingToolCalls = streamingToolCalls.map((tc) =>
                  tc.id === toolCall.id ? { ...tc, processed: true } : tc
                );
              }
            }

            return { ...currentState, streamingToolCalls };
          });
        };

        while (true) {
          const { value, done } = await reader.read();
          if (done) {
            console.log('[AI Spreadsheet] Stream ended. Total chunks:', chunkCount);
            break;
          }

          chunkCount++;
          const chunkText = decoder.decode(value, { stream: true });
          buffer += chunkText;
          console.log(`[AI Spreadsheet] Chunk ${chunkCount}:`, chunkText.substring(0, 200));

          const lines = buffer.split('\n');
          // Keep the last incomplete line in the buffer
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                console.log('[AI Spreadsheet] Parsed SSE data:', {
                  hasContent: !!data.content,
                  contentType: typeof data.content,
                  isArray: Array.isArray(data.content),
                  hasToolCalls: !!data.toolCalls,
                  toolCallCount: data.toolCalls?.length || 0,
                });

                // Extract text content - handle both string and array formats
                // Each SSE event contains cumulative content, so we replace rather than append
                if (typeof data.content === 'string') {
                  assistantMessage = data.content;
                } else if (Array.isArray(data.content)) {
                  // Collect all text from this event
                  const textContent = data.content
                    .filter((c: any) => c.type === 'text' && c.text)
                    .map((c: any) => c.text)
                    .join('');
                  if (textContent) {
                    assistantMessage = textContent;
                  }
                }

                // Extract tool calls - accumulate by ID to handle streaming updates
                // SSE events are cumulative, so each event contains the full current state of tool calls
                if (data.toolCalls && data.toolCalls.length > 0) {
                  console.log('[AI Spreadsheet] Found tool calls in SSE event:', data.toolCalls.length, data.toolCalls);
                  // Replace with the latest tool calls from the server (they're cumulative)
                  // This ensures we get the complete set including multiple calls of the same tool type
                  toolCalls = data.toolCalls.map((tc: { id?: string; name: string; arguments: unknown }) => ({
                    id: tc.id || `tool_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
                    name: tc.name,
                    arguments: typeof tc.arguments === 'string' ? tc.arguments : JSON.stringify(tc.arguments),
                  }));
                  console.log('[AI Spreadsheet] Updated tool calls. Total:', toolCalls.length);
                }

                // Update streaming state for live updates (this also processes new tool calls)
                updateStreamingState(assistantMessage, toolCalls);
              } catch (parseError) {
                console.log('[AI Spreadsheet] Parse error on line:', line.substring(0, 100), parseError);
              }
            }
          }
        }

        console.log('[AI Spreadsheet] Stream complete. Final state:', {
          assistantMessage: assistantMessage.substring(0, 100),
          toolCallCount: toolCalls.length,
          toolCalls: toolCalls.map((tc) => tc.name),
        });

        // Build response message
        let responseText = assistantMessage;
        if (toolCalls.length > 0 && !responseText) {
          responseText = `I've added ${toolCalls.length} cell${toolCalls.length > 1 ? 's' : ''} to the canvas.`;
        }

        console.log('[AI Spreadsheet] About to update final state with responseText:', responseText.substring(0, 100));

        // Find any code nodes that were created by tool calls and execute them
        const codeNodeToolCalls = toolCalls.filter((tc) => tc.name === AiSpreadsheetTool.AddTransformNode);

        // Execute code nodes and collect errors
        const executionErrors: string[] = [];

        if (codeNodeToolCalls.length > 0) {
          console.log('[AI Spreadsheet] Executing code nodes created by tool calls:', codeNodeToolCalls.length);

          // Get current state to access nodes and edges
          // We need to do this in a way that ensures we have the latest state
          let currentNodes: AiSpreadsheetNode[] = [];
          let currentEdges: { source: string; target: string }[] = [];

          setState((prev) => {
            currentNodes = prev.nodes;
            currentEdges = prev.edges;
            return prev; // Don't change state, just read it
          });

          // Wait for state to settle
          await new Promise((resolve) => setTimeout(resolve, 100));

          // Re-read the state to get latest
          setState((prev) => {
            currentNodes = prev.nodes;
            currentEdges = prev.edges;
            return prev;
          });

          for (const tc of codeNodeToolCalls) {
            try {
              const args = JSON.parse(tc.arguments);
              if (args.transform_type !== 'code') continue;

              // Get the actual node ID from the map
              const actualNodeId = nodeIdMapRef.current.get(args.node_id);
              if (!actualNodeId) {
                console.warn('[AI Spreadsheet] Could not find node ID for:', args.node_id);
                continue;
              }

              console.log('[AI Spreadsheet] Executing code node:', actualNodeId);

              const execResult = await executeCodeNodeAndGetResult(actualNodeId, currentNodes, currentEdges);

              if (execResult) {
                // Update node with result
                setState((prev) => ({
                  ...prev,
                  nodes: prev.nodes.map((n) =>
                    n.id === actualNodeId
                      ? {
                          ...n,
                          data: {
                            ...n.data,
                            executionState: execResult.result.type === 'error' ? 'error' : 'success',
                            result: execResult.result,
                          } as CodeNodeData,
                        }
                      : n
                  ),
                }));

                // Collect errors
                if (execResult.result.type === 'error') {
                  const errorMsg =
                    `Code cell "${execResult.codeData.label}" execution error:\n` +
                    `Error: ${execResult.result.error}\n` +
                    (execResult.result.stdout ? `Console: ${execResult.result.stdout}\n` : '') +
                    `Code:\n\`\`\`python\n${execResult.codeData.code}\n\`\`\``;
                  executionErrors.push(errorMsg);
                }
              }
            } catch (e) {
              console.error('[AI Spreadsheet] Error executing code node:', e);
            }
          }
        }

        // Update final state - tool calls are already processed during streaming
        setState((prev) => {
          console.log('[AI Spreadsheet] Inside setState. prev.chatMessages.length:', prev.chatMessages.length);

          // Add AI response message to the latest chat messages
          const newMessage = {
            id: crypto.randomUUID(),
            role: 'assistant' as const,
            content: responseText,
            timestamp: Date.now(),
            toolCalls: toolCalls.map((tc) => ({
              id: tc.id,
              name: tc.name,
              arguments: tc.arguments,
            })),
          };

          return {
            ...prev,
            chatMessages: [...prev.chatMessages, newMessage],
            loading: executionErrors.length > 0, // Keep loading if we need to fix errors
            streamingContent: '',
            streamingToolCalls: [],
          };
        });

        console.log('[AI Spreadsheet] setState called, function complete');

        // If there were execution errors, automatically call the AI to fix them
        if (executionErrors.length > 0) {
          console.log('[AI Spreadsheet] Execution errors found, calling AI to fix:', executionErrors.length);
          const errorContext =
            `The following Python execution errors occurred:\n\n` +
            executionErrors.join('\n\n---\n\n') +
            `\n\nPlease fix these errors by updating the code cells.`;

          // Call AI again with the error context (recursive call)
          await processAiResponseInternal(errorContext, connections, recursionDepth + 1);
          return;
        }
      } catch (error: any) {
        if (error.name === 'AbortError') {
          setState((prev) => ({
            ...prev,
            loading: false,
            streamingContent: '',
            streamingToolCalls: [],
          }));
          return;
        }

        console.error('Error calling AI API:', error);

        // Show error message using functional update to get latest state
        setState((prev) => {
          const newMessage = {
            id: crypto.randomUUID(),
            role: 'assistant' as const,
            content: 'AI connection error. Please try again.',
            timestamp: Date.now(),
          };
          return {
            ...prev,
            chatMessages: [...prev.chatMessages, newMessage],
            loading: false,
            streamingContent: '',
            streamingToolCalls: [],
          };
        });
      }
    },
    [state, setState, processToolCall]
  );

  // Wrapper function to start processing (recursionDepth = 0)
  const processAiResponse = useCallback(
    (userMessage: string, connections: Connection[]) => {
      return processAiResponseInternal(userMessage, connections, 0);
    },
    [processAiResponseInternal]
  );

  return {
    processAiResponse,
    abortRequest: () => abortControllerRef.current?.abort(),
  };
}

// Helper functions
function mapInputType(type: string): AiNodeType {
  switch (type) {
    case 'connection':
      return 'connection';
    case 'file':
      return 'file';
    case 'cell':
      return 'cell';
    case 'data_table':
      return 'dataTable';
    case 'web_search':
      return 'webSearch';
    case 'html':
      return 'html';
    default:
      return 'cell';
  }
}

function mapOutputType(type: string): AiNodeType {
  switch (type) {
    case 'table':
      return 'table';
    case 'chart':
      return 'chart';
    case 'html':
      return 'htmlOutput';
    default:
      return 'table';
  }
}

function buildInputNodeData(parsed: any): Partial<AddNodeArgs['data']> {
  // All input nodes get the name field for q.get() reference
  const baseName = parsed.name || parsed.node_id || parsed.label.toLowerCase().replace(/\s+/g, '_');

  switch (parsed.input_type) {
    case 'connection':
      return {
        name: baseName,
        connectionUuid: parsed.connection_uuid || '',
        connectionName: parsed.connection_name || 'Database',
        connectionType: parsed.connection_type || 'POSTGRES',
        query: parsed.query || '',
      };
    case 'file':
      return {
        name: baseName,
        fileName: parsed.file_name || 'data.csv',
        fileType: parsed.file_type || 'text/csv',
      };
    case 'cell':
      return {
        name: baseName,
        value: parsed.value || '',
      };
    case 'data_table':
      return {
        name: baseName,
        columns: parsed.columns || ['Column 1'],
        rows: parsed.rows || [],
      };
    case 'web_search':
      return {
        name: baseName,
        query: parsed.search_query || '',
      };
    case 'html':
      return {
        name: baseName,
        htmlContent: parsed.html_content || '',
      };
    default:
      return { name: baseName };
  }
}

function buildOutputNodeData(parsed: any): Partial<AddNodeArgs['data']> {
  switch (parsed.output_type) {
    case 'table':
      return {
        columns: parsed.columns || [],
        rows: [],
        totalRows: 0,
      };
    case 'chart':
      return {
        chartType: parsed.chart_type || 'bar',
        config: {},
      };
    case 'html':
      return {
        htmlContent: '',
      };
    default:
      return {};
  }
}
