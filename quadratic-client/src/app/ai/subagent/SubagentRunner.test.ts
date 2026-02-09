import { createTextContent } from 'quadratic-shared/ai/helpers/message.helper';
import { AITool } from 'quadratic-shared/ai/specs/aiToolsSpec';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SubagentType } from './subagentTypes';

// ============================================================================
// Hoisted Mocks
// ============================================================================

const { mockAuthGetToken, mockApiFetch, mockContextBuilderBuildContext, mockToolsActions } = vi.hoisted(() => {
  return {
    mockAuthGetToken: vi.fn(() => Promise.resolve('test-token')),
    mockApiFetch: vi.fn(),
    mockContextBuilderBuildContext: vi.fn(),
    mockToolsActions: {
      [AITool.GetCellData]: vi.fn(() => Promise.resolve([createTextContent('Cell data result')])),
      [AITool.HasCellData]: vi.fn(() => Promise.resolve([createTextContent('true')])),
      [AITool.TextSearch]: vi.fn(() => Promise.resolve([createTextContent('Search result')])),
      [AITool.GetDatabaseSchemas]: vi.fn(() => Promise.resolve([createTextContent('Schema result')])),
    },
  };
});

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

vi.mock('../tools/aiToolsActions', () => ({
  aiToolsActions: mockToolsActions,
}));

// Mock global fetch
const originalFetch = global.fetch;

// ============================================================================
// Tests
// ============================================================================

describe('SubagentRunner', () => {
  let SubagentRunner: typeof import('./SubagentRunner').SubagentRunner;
  let subagentRunner: import('./SubagentRunner').SubagentRunner;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Reset fetch mock
    global.fetch = vi.fn(mockApiFetch);

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
      // Mock API response with no tool calls (subagent finished)
      mockApiFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            role: 'assistant',
            content: [
              createTextContent(
                'I found the data you were looking for.\n\nSummary: Sales data in Sheet1\nRanges found:\n- Sheet1!A1:D100: Sales records'
              ),
            ],
            contextType: 'userPrompt',
            toolCalls: [],
            modelKey: 'vertexai-anthropic:claude-haiku-4-5@20251001',
          }),
      });

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
      // First API call - returns a tool call
      mockApiFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            role: 'assistant',
            content: [createTextContent('Let me search for that data.')],
            contextType: 'userPrompt',
            toolCalls: [
              {
                id: 'tool-1',
                name: AITool.GetCellData,
                arguments: JSON.stringify({ selection: 'A1:D10' }),
              },
            ],
            modelKey: 'vertexai-anthropic:claude-haiku-4-5@20251001',
          }),
      });

      // Second API call - no tool calls (finished)
      mockApiFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            role: 'assistant',
            content: [createTextContent('Found the data at Sheet1!A1:D10: Contains sales records')],
            contextType: 'userPrompt',
            toolCalls: [],
            modelKey: 'vertexai-anthropic:claude-haiku-4-5@20251001',
          }),
      });

      const result = await subagentRunner.execute({
        subagentType: SubagentType.DataFinder,
        task: 'Find sales data',
        modelKey: 'vertexai-anthropic:claude-haiku-4-5@20251001',
        fileUuid: 'test-file-uuid',
        teamUuid: 'test-team-uuid',
      });

      expect(result.success).toBe(true);
      expect(mockToolsActions[AITool.GetCellData]).toHaveBeenCalled();
    });

    it('should filter out disallowed tool calls', async () => {
      // API returns a disallowed tool call (e.g., SetCellValues)
      mockApiFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            role: 'assistant',
            content: [createTextContent('Trying to set values')],
            contextType: 'userPrompt',
            toolCalls: [
              {
                id: 'tool-1',
                name: AITool.SetCellValues, // Not allowed for data_finder
                arguments: JSON.stringify({ selection: 'A1', values: [['test']] }),
              },
            ],
            modelKey: 'vertexai-anthropic:claude-haiku-4-5@20251001',
          }),
      });

      // Second call with no tool calls
      mockApiFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            role: 'assistant',
            content: [createTextContent('No data found')],
            contextType: 'userPrompt',
            toolCalls: [],
            modelKey: 'vertexai-anthropic:claude-haiku-4-5@20251001',
          }),
      });

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
      mockApiFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

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
      mockApiFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            role: 'assistant',
            content: [
              createTextContent(`Found the following data:
- Sheet1!A1:D100: Sales data
- Sheet2!B5:F50: Customer info
- C10:E20: Local data`),
            ],
            contextType: 'userPrompt',
            toolCalls: [],
            modelKey: 'vertexai-anthropic:claude-haiku-4-5@20251001',
          }),
      });

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
