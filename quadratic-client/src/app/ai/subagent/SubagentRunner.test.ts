import { createTextContent } from 'quadratic-shared/ai/helpers/message.helper';
import { AITool } from 'quadratic-shared/ai/specs/aiToolsSpec';
import type { AIResponseContent, AIToolCall } from 'quadratic-shared/typesAndSchemasAI';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SubagentType } from './subagentTypes';

/** Creates a streaming Response that emits SSE chunks the SubagentRunner expects */
function createStreamingResponse(chunk: {
  content: AIResponseContent;
  toolCalls: AIToolCall[];
  modelKey?: string;
}): Response {
  const sseChunk = {
    ...chunk,
    role: 'assistant' as const,
    contextType: 'userPrompt' as const,
    modelKey: chunk.modelKey ?? 'vertexai-anthropic:claude-haiku-4-5@20251001',
    isOnPaidPlan: true,
    exceededBillingLimit: false,
  };
  const body = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(sseChunk)}\n\n`));
      controller.close();
    },
  });
  return new Response(body, {
    status: 200,
    headers: { 'Content-Type': 'text/event-stream' },
  });
}

// ============================================================================
// Hoisted Mocks
// ============================================================================

const { mockAuthGetToken, mockContextBuilderBuildContext, mockExecuteAIToolFromJson } = vi.hoisted(() => ({
  mockAuthGetToken: vi.fn(() => Promise.resolve('test-token')),
  mockContextBuilderBuildContext: vi.fn(),
  mockExecuteAIToolFromJson: vi.fn((toolName: string) => {
    const results: Record<string, ReturnType<typeof createTextContent>[]> = {
      [AITool.GetCellData]: [createTextContent('Cell data result')],
      [AITool.HasCellData]: [createTextContent('true')],
      [AITool.TextSearch]: [createTextContent('Search result')],
      [AITool.GetDatabaseSchemas]: [createTextContent('Schema result')],
    };
    return Promise.resolve(results[toolName] ?? [createTextContent('Unknown tool result')]);
  }),
}));

// ============================================================================
// Module Mocks
// ============================================================================

vi.mock('@/auth/auth', () => ({
  authClient: {
    getTokenOrRedirect: mockAuthGetToken,
  },
}));

vi.mock('@/shared/api/apiClient', () => ({
  apiClient: {
    getApiUrl: vi.fn(() => 'http://test-api'),
  },
}));

vi.mock('./SubagentContextBuilder', () => ({
  subagentContextBuilder: {
    buildContext: mockContextBuilderBuildContext,
  },
}));

vi.mock('../tools/executeAITool', () => ({
  executeAIToolFromJson: mockExecuteAIToolFromJson,
}));

const mockSession = {
  id: 'test-session-id',
  type: 'data_finder',
  messages: [] as import('quadratic-shared/typesAndSchemasAI').ChatMessage[],
  lastUpdated: Date.now(),
};
vi.mock('../session/SubagentSessionManager', () => ({
  subagentSessionManager: {
    hasSession: vi.fn(() => false),
    clearAllSessions: vi.fn(),
    createSession: vi.fn(() => mockSession),
    getSession: vi.fn(() => mockSession),
    getMessages: vi.fn(() => []),
    setMessages: vi.fn(),
    setLastSummary: vi.fn(),
    refreshContext: vi.fn(),
  },
}));

const originalFetch = global.fetch;

// ============================================================================
// Tests
// ============================================================================

describe('SubagentRunner', () => {
  let SubagentRunner: typeof import('./SubagentRunner').SubagentRunner;
  let subagentRunner: import('./SubagentRunner').SubagentRunner;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.clearAllMocks();
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    // Re-import to get fresh instance
    const module = await import('./SubagentRunner');
    SubagentRunner = module.SubagentRunner;
    subagentRunner = new SubagentRunner();

    // Default mock implementations
    mockContextBuilderBuildContext.mockResolvedValue([
      {
        role: 'user',
        content: [createTextContent('Current sheet data')],
        contextType: 'fileSummary',
      },
    ]);
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('execute', () => {
    it('should execute a data_finder subagent and return result', async () => {
      fetchMock.mockResolvedValueOnce(
        createStreamingResponse({
          content: [
            createTextContent(
              'I found the data you were looking for.\n\nSummary: Sales data in Sheet1\nRanges found:\n- Sheet1!A1:D100: Sales records'
            ),
          ],
          toolCalls: [],
        })
      );

      const result = await subagentRunner.execute({
        subagentType: SubagentType.DataFinder,
        task: 'Find all sales data',
        modelKey: 'vertexai-anthropic:claude-haiku-4-5@20251001',
        fileUuid: 'test-file-uuid',
        teamUuid: 'test-team-uuid',
      });

      expect(result.success).toBe(true);
      expect(result.summary).toContain('I found the data');
      expect(result.ranges).toBeDefined();
      expect(result.ranges?.length).toBeGreaterThan(0);
    });

    it('should execute tool calls and continue the loop', async () => {
      fetchMock.mockResolvedValueOnce(
        createStreamingResponse({
          content: [createTextContent('Let me search for that data.')],
          toolCalls: [
            {
              id: 'tool-1',
              name: AITool.GetCellData,
              arguments: JSON.stringify({ selection: 'A1:D10' }),
              loading: false,
            },
          ],
        })
      );

      fetchMock.mockResolvedValueOnce(
        createStreamingResponse({
          content: [createTextContent('Found the data at Sheet1!A1:D10: Contains sales records')],
          toolCalls: [],
        })
      );

      const result = await subagentRunner.execute({
        subagentType: SubagentType.DataFinder,
        task: 'Find sales data',
        modelKey: 'vertexai-anthropic:claude-haiku-4-5@20251001',
        fileUuid: 'test-file-uuid',
        teamUuid: 'test-team-uuid',
      });

      expect(result.success).toBe(true);
      expect(mockExecuteAIToolFromJson).toHaveBeenCalled();
    });

    it('should filter out disallowed tool calls', async () => {
      fetchMock.mockResolvedValueOnce(
        createStreamingResponse({
          content: [createTextContent('Trying to set values')],
          toolCalls: [
            {
              id: 'tool-1',
              name: AITool.SetCellValues,
              arguments: JSON.stringify({ selection: 'A1', values: [['test']] }),
              loading: false,
            },
          ],
        })
      );

      fetchMock.mockResolvedValueOnce(
        createStreamingResponse({
          content: [createTextContent('No data found')],
          toolCalls: [],
        })
      );

      const result = await subagentRunner.execute({
        subagentType: SubagentType.DataFinder,
        task: 'Find data',
        modelKey: 'vertexai-anthropic:claude-haiku-4-5@20251001',
        fileUuid: 'test-file-uuid',
        teamUuid: 'test-team-uuid',
      });

      // The disallowed tool call should have been filtered out
      // and the subagent should still succeed
      expect(result.success).toBe(true);
    });

    it('should handle API errors', async () => {
      fetchMock.mockResolvedValueOnce(new Response(null, { status: 500 }));

      const result = await subagentRunner.execute({
        subagentType: SubagentType.DataFinder,
        task: 'Find data',
        modelKey: 'vertexai-anthropic:claude-haiku-4-5@20251001',
        fileUuid: 'test-file-uuid',
        teamUuid: 'test-team-uuid',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('API request failed');
    });

    it('should handle abort signal', async () => {
      const abortController = new AbortController();
      abortController.abort();

      const result = await subagentRunner.execute({
        subagentType: SubagentType.DataFinder,
        task: 'Find data',
        modelKey: 'vertexai-anthropic:claude-haiku-4-5@20251001',
        fileUuid: 'test-file-uuid',
        teamUuid: 'test-team-uuid',
        abortSignal: abortController.signal,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Aborted by user');
    });
  });

  describe('extractRanges', () => {
    it('should extract ranges from text', async () => {
      fetchMock.mockResolvedValueOnce(
        createStreamingResponse({
          content: [
            createTextContent(`Found the following data:
- Sheet1!A1:D100: Sales data
- Sheet2!B5:F50: Customer info
- C10:E20: Local data`),
          ],
          toolCalls: [],
        })
      );

      const result = await subagentRunner.execute({
        subagentType: SubagentType.DataFinder,
        task: 'Find all data',
        modelKey: 'vertexai-anthropic:claude-haiku-4-5@20251001',
        fileUuid: 'test-file-uuid',
        teamUuid: 'test-team-uuid',
      });

      expect(result.success).toBe(true);
      expect(result.ranges).toBeDefined();
      expect(result.ranges?.length).toBe(3);
      expect(result.ranges?.[0].sheet).toBe('Sheet1');
      expect(result.ranges?.[0].range).toBe('A1:D100');
    });
  });
});
