import { createTextContent } from 'quadratic-shared/ai/helpers/message.helper';
import { AITool } from 'quadratic-shared/ai/specs/aiToolsSpec';
import type { AIToolCall } from 'quadratic-shared/typesAndSchemasAI';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToolExecutor } from './ToolExecutor';
import type { ToolExecutionOptions } from './types';

// Mock the aiToolsActions
vi.mock('../tools/aiToolsActions', () => ({
  aiToolsActions: {
    [AITool.SetCellValues]: vi.fn().mockResolvedValue([{ type: 'text', text: 'Cell values set' }]),
    [AITool.MoveCells]: vi.fn().mockResolvedValue([{ type: 'text', text: 'Cells moved' }]),
    [AITool.GetCodeCellValue]: vi.fn().mockResolvedValue([{ type: 'text', text: 'Code contents' }]),
    [AITool.UserPromptSuggestions]: vi.fn().mockResolvedValue([{ type: 'text', text: 'Suggestions' }]),
  },
}));

describe('ToolExecutor', () => {
  let toolExecutor: ToolExecutor;

  const defaultOptions: ToolExecutionOptions = {
    source: 'AIAnalyst',
    chatId: 'test-chat-id',
    messageIndex: 0,
  };

  const createToolCall = (
    name: string,
    args: Record<string, unknown> = {},
    id = `call-${Math.random().toString(36).slice(2)}`
  ): AIToolCall => ({
    id,
    name,
    arguments: JSON.stringify(args),
    loading: false,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    toolExecutor = new ToolExecutor();
  });

  describe('executeToolCalls', () => {
    it('executes multiple tool calls and returns results', async () => {
      const toolCalls: AIToolCall[] = [
        createToolCall(AITool.SetCellValues, { values: [] }, 'call-1'),
        createToolCall(AITool.MoveCells, { from: 'A1', to: 'B1' }, 'call-2'),
      ];

      const result = await toolExecutor.executeToolCalls(toolCalls, defaultOptions);

      expect(result.role).toBe('user');
      expect(result.contextType).toBe('toolResult');
      expect(result.content).toHaveLength(2);
      expect(result.content[0].id).toBe('call-1');
      expect(result.content[1].id).toBe('call-2');
    });

    it('skips PDF import tool calls', async () => {
      const toolCalls: AIToolCall[] = [
        createToolCall(AITool.PDFImport, { action: 'import' }, 'pdf-1'),
        createToolCall(AITool.SetCellValues, { values: [] }, 'set-1'),
      ];

      const result = await toolExecutor.executeToolCalls(toolCalls, defaultOptions);

      // Should only have result for SetCellValues, not PDFImport
      expect(result.content).toHaveLength(1);
      expect(result.content[0].id).toBe('set-1');
    });

    it('skips web search tool calls', async () => {
      const toolCalls: AIToolCall[] = [
        createToolCall(AITool.WebSearch, { query: 'test' }, 'search-1'),
        createToolCall(AITool.MoveCells, { from: 'A1', to: 'B1' }, 'move-1'),
      ];

      const result = await toolExecutor.executeToolCalls(toolCalls, defaultOptions);

      // Should only have result for MoveCells, not WebSearch
      expect(result.content).toHaveLength(1);
      expect(result.content[0].id).toBe('move-1');
    });

    it('returns empty content array when all tools are special', async () => {
      const toolCalls: AIToolCall[] = [
        createToolCall(AITool.PDFImport, { action: 'import' }, 'pdf-1'),
        createToolCall(AITool.WebSearch, { query: 'test' }, 'search-1'),
      ];

      const result = await toolExecutor.executeToolCalls(toolCalls, defaultOptions);

      expect(result.content).toHaveLength(0);
    });
  });

  describe('executeSingleTool', () => {
    it('returns error for unknown tool', async () => {
      const toolCall = createToolCall('unknown_tool', {});

      const result = await toolExecutor.executeSingleTool(toolCall, defaultOptions);

      expect(result).toEqual([createTextContent('Unknown tool')]);
    });

    it('returns error when argument parsing fails', async () => {
      const toolCall: AIToolCall = {
        id: 'test-id',
        name: AITool.SetCellValues,
        arguments: 'invalid json{{{',
        loading: false,
      };

      const result = await toolExecutor.executeSingleTool(toolCall, defaultOptions);

      expect(result[0]).toEqual(
        expect.objectContaining({
          type: 'text',
          text: expect.stringContaining('Error parsing'),
        })
      );
    });

    it('handles empty arguments gracefully', async () => {
      const toolCall: AIToolCall = {
        id: 'test-id',
        name: AITool.SetCellValues,
        arguments: '',
        loading: false,
      };

      // This should not throw, as empty string becomes {}
      const result = await toolExecutor.executeSingleTool(toolCall, defaultOptions);

      // Result depends on schema validation - either success or parse error
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('isSpecialTool', () => {
    it('returns true for PDF import tool', () => {
      const toolCall = createToolCall(AITool.PDFImport);

      expect(toolExecutor.isSpecialTool(toolCall)).toBe(true);
    });

    it('returns true for web search tool', () => {
      const toolCall = createToolCall(AITool.WebSearch);

      expect(toolExecutor.isSpecialTool(toolCall)).toBe(true);
    });

    it('returns false for regular tools', () => {
      const toolCall = createToolCall(AITool.SetCellValues);

      expect(toolExecutor.isSpecialTool(toolCall)).toBe(false);
    });
  });

  describe('filterToolCalls', () => {
    it('filters tool calls by name', () => {
      const toolCalls: AIToolCall[] = [
        createToolCall(AITool.SetCellValues, {}, 'set-1'),
        createToolCall(AITool.MoveCells, {}, 'move-1'),
        createToolCall(AITool.SetCellValues, {}, 'set-2'),
      ];

      const result = toolExecutor.filterToolCalls(toolCalls, AITool.SetCellValues);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('set-1');
      expect(result[1].id).toBe('set-2');
    });

    it('returns empty array when no matches', () => {
      const toolCalls: AIToolCall[] = [createToolCall(AITool.SetCellValues), createToolCall(AITool.MoveCells)];

      const result = toolExecutor.filterToolCalls(toolCalls, AITool.PDFImport);

      expect(result).toHaveLength(0);
    });
  });

  describe('isPromptSuggestionsTool', () => {
    it('returns true for user prompt suggestions tool', () => {
      const toolCall = createToolCall(AITool.UserPromptSuggestions);

      expect(toolExecutor.isPromptSuggestionsTool(toolCall)).toBe(true);
    });

    it('returns false for other tools', () => {
      const toolCall = createToolCall(AITool.SetCellValues);

      expect(toolExecutor.isPromptSuggestionsTool(toolCall)).toBe(false);
    });
  });

  describe('parsePromptSuggestions', () => {
    it('parses valid prompt suggestions', () => {
      const toolCall = createToolCall(AITool.UserPromptSuggestions, {
        prompt_suggestions: [
          { label: 'Test 1', prompt: 'Prompt 1' },
          { label: 'Test 2', prompt: 'Prompt 2' },
        ],
      });

      const result = toolExecutor.parsePromptSuggestions(toolCall);

      expect(result).toEqual({
        prompt_suggestions: [
          { label: 'Test 1', prompt: 'Prompt 1' },
          { label: 'Test 2', prompt: 'Prompt 2' },
        ],
      });
    });

    it('returns null for non-prompt-suggestions tool', () => {
      const toolCall = createToolCall(AITool.SetCellValues);

      const result = toolExecutor.parsePromptSuggestions(toolCall);

      expect(result).toBeNull();
    });

    it('returns null for invalid arguments', () => {
      const toolCall: AIToolCall = {
        id: 'test-id',
        name: AITool.UserPromptSuggestions,
        arguments: 'invalid json{{{',
        loading: false,
      };

      const result = toolExecutor.parsePromptSuggestions(toolCall);

      expect(result).toBeNull();
    });

    it('returns null for empty arguments', () => {
      const toolCall: AIToolCall = {
        id: 'test-id',
        name: AITool.UserPromptSuggestions,
        arguments: '',
        loading: false,
      };

      const result = toolExecutor.parsePromptSuggestions(toolCall);

      // Empty string becomes {} which may fail schema validation
      expect(result).toBeNull();
    });
  });
});

describe('ToolExecutor edge cases', () => {
  let toolExecutor: ToolExecutor;

  const defaultOptions: ToolExecutionOptions = {
    source: 'AIAnalyst',
    chatId: 'test-chat-id',
    messageIndex: 0,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    toolExecutor = new ToolExecutor();
  });

  it('handles tool call with undefined arguments', async () => {
    const toolCall: AIToolCall = {
      id: 'test-id',
      name: AITool.SetCellValues,
      arguments: undefined as unknown as string,
      loading: false,
    };

    // Should not throw
    const result = await toolExecutor.executeSingleTool(toolCall, defaultOptions);
    expect(Array.isArray(result)).toBe(true);
  });

  it('handles concurrent tool execution', async () => {
    const toolCalls: AIToolCall[] = Array.from({ length: 5 }, (_, i) => ({
      id: `call-${i}`,
      name: AITool.SetCellValues,
      arguments: JSON.stringify({ values: [] }),
      loading: false,
    }));

    const result = await toolExecutor.executeToolCalls(toolCalls, defaultOptions);

    // All should complete (minus special tools if any)
    expect(result.content).toHaveLength(5);
  });

  it('preserves tool call order in results', async () => {
    const toolCalls: AIToolCall[] = [
      { id: 'first', name: AITool.SetCellValues, arguments: '{}', loading: false },
      { id: 'second', name: AITool.MoveCells, arguments: '{}', loading: false },
      { id: 'third', name: AITool.GetCodeCellValue, arguments: '{}', loading: false },
    ];

    const result = await toolExecutor.executeToolCalls(toolCalls, defaultOptions);

    expect(result.content[0].id).toBe('first');
    expect(result.content[1].id).toBe('second');
    expect(result.content[2].id).toBe('third');
  });
});
