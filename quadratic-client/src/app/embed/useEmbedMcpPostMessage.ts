import { useEffect } from 'react';
import { executeAIToolFromJson } from '@/app/ai/tools/executeAITool';
import { sheets } from '@/app/grid/controller/Sheets';
import type { AITool } from 'quadratic-shared/ai/specs/aiToolsSpec';

interface McpCommand {
  type: 'quadratic-mcp-command';
  id: string;
  command: string;
  params: Record<string, unknown>;
}

function isMcpCommand(data: unknown): data is McpCommand {
  return (
    typeof data === 'object' &&
    data !== null &&
    (data as McpCommand).type === 'quadratic-mcp-command' &&
    typeof (data as McpCommand).id === 'string' &&
    typeof (data as McpCommand).command === 'string'
  );
}

function sendResponse(id: string, success: boolean, result?: unknown, error?: string) {
  window.parent.postMessage({ type: 'quadratic-mcp-response', id, success, result, error }, '*');
}

function handleGetSheetInfo(id: string) {
  const info = sheets.sheets.map((s) => ({ id: s.id, name: s.name, order: s.order, color: s.color }));
  sendResponse(id, true, { sheets: info });
}

async function handleCommand(id: string, command: string, params: Record<string, unknown>) {
  try {
    if (command === 'get_sheet_info') {
      handleGetSheetInfo(id);
      return;
    }

    const metaData = { source: 'AIAnalyst' as const, chatId: `mcp-${id}`, messageIndex: 0 };
    const argsJson = JSON.stringify(params);
    const toolResult = await executeAIToolFromJson(command as AITool, argsJson, metaData);
    sendResponse(id, true, toolResult);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    sendResponse(id, false, undefined, message);
  }
}

/**
 * Listens for MCP tool-call commands from the parent window (via postMessage)
 * and executes them using the existing AI tool infrastructure.
 */
export function useEmbedMcpPostMessage() {
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (!isMcpCommand(event.data)) return;
      const { id, command, params } = event.data;
      handleCommand(id, command, params);
    };

    window.addEventListener('message', handler);
    window.parent.postMessage({ type: 'quadratic-mcp-ready' }, '*');

    return () => window.removeEventListener('message', handler);
  }, []);
}
