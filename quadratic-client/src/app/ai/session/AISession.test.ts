import { createTextContent } from 'quadratic-shared/ai/helpers/message.helper';
import { DEFAULT_BACKUP_MODEL } from 'quadratic-shared/ai/models/AI_MODELS';
import { AITool } from 'quadratic-shared/ai/specs/aiToolsSpec';
import type {
  AIToolCall,
  ChatMessage,
  Context,
  ToolResultMessage,
  UserMessagePrompt,
} from 'quadratic-shared/typesAndSchemasAI';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AIAPIResponse, AISessionRequest, Connection, ImportFile } from './types';

// ============================================================================
// Hoisted Mocks - These are hoisted to the top of the file before vi.mock
// ============================================================================

const {
  mockStoreData,
  mockStoreGet,
  mockStoreSet,
  mockMessageManagerGetMessages,
  mockMessageManagerSetMessages,
  mockMessageManagerGetCurrentChat,
  mockMessageManagerInitializeNewChat,
  mockMessageManagerForkChat,
  mockMessageManagerEnsureChatId,
  mockMessageManagerAddUserMessage,
  mockMessageManagerAddToolResultMessage,
  mockMessageManagerReplaceOldToolCallResults,
  mockMessageManagerHandleAbort,
  mockMessageManagerHandleError,
  mockMessageManagerClearPromptSuggestions,
  mockMessageManagerSetPromptSuggestions,
  mockContextBuilderBuildContext,
  mockToolExecutorExecuteToolCalls,
  mockToolExecutorIsPromptSuggestionsTool,
  mockToolExecutorParsePromptSuggestions,
  mockToolExecutorFilterToolCalls,
  mockToolExecutorIsSpecialTool,
  mockAPIClientSendRequest,
} = vi.hoisted(() => {
  const mockStoreData = new Map<unknown, unknown>();
  return {
    mockStoreData,
    mockStoreGet: vi.fn((atom: unknown) => mockStoreData.get(atom)),
    mockStoreSet: vi.fn((atom: unknown, value: unknown) => mockStoreData.set(atom, value)),
    mockMessageManagerGetMessages: vi.fn(),
    mockMessageManagerSetMessages: vi.fn(),
    mockMessageManagerGetCurrentChat: vi.fn(),
    mockMessageManagerInitializeNewChat: vi.fn(() => 'new-chat-id'),
    mockMessageManagerForkChat: vi.fn(() => 'forked-chat-id'),
    mockMessageManagerEnsureChatId: vi.fn(() => 'test-chat-id'),
    mockMessageManagerAddUserMessage: vi.fn(),
    mockMessageManagerAddToolResultMessage: vi.fn(),
    mockMessageManagerReplaceOldToolCallResults: vi.fn(),
    mockMessageManagerHandleAbort: vi.fn(),
    mockMessageManagerHandleError: vi.fn(),
    mockMessageManagerClearPromptSuggestions: vi.fn(),
    mockMessageManagerSetPromptSuggestions: vi.fn(),
    mockContextBuilderBuildContext: vi.fn(),
    mockToolExecutorExecuteToolCalls: vi.fn(),
    mockToolExecutorIsPromptSuggestionsTool: vi.fn(() => false),
    mockToolExecutorParsePromptSuggestions: vi.fn(),
    mockToolExecutorFilterToolCalls: vi.fn(),
    mockToolExecutorIsSpecialTool: vi.fn(() => false),
    mockAPIClientSendRequest: vi.fn(),
  };
});

// ============================================================================
// Module Mocks - These must be defined before importing the module under test
// ============================================================================

// Mock external dependencies
vi.mock('@/app/grid/controller/Sheets', () => ({
  sheets: {
    current: 'test-sheet-id',
    stringToSelection: vi.fn(() => ({
      save: vi.fn(() => 'A1'),
    })),
  },
}));

vi.mock('@/app/web-workers/multiplayerWebWorker/aiUser', () => ({
  aiUser: {
    updateSelection: vi.fn(),
  },
}));

vi.mock('@/app/web-workers/multiplayerWebWorker/multiplayer', () => ({
  multiplayer: {
    setAIUser: vi.fn(),
  },
}));

vi.mock('@/shared/utils/analyticsEvents', () => ({
  trackEvent: vi.fn(),
}));

vi.mock('../atoms/aiAnalystAtoms', () => ({
  abortControllerAtom: Symbol('abortControllerAtom'),
  aiStore: {
    get: mockStoreGet,
    set: mockStoreSet,
  },
  loadingAtom: Symbol('loadingAtom'),
  pdfImportAtom: Symbol('pdfImportAtom'),
  showAIAnalystAtom: Symbol('showAIAnalystAtom'),
  showChatHistoryAtom: Symbol('showChatHistoryAtom'),
  waitingOnMessageIndexAtom: Symbol('waitingOnMessageIndexAtom'),
  webSearchAtom: Symbol('webSearchAtom'),
}));

vi.mock('./MessageManager', () => ({
  messageManager: {
    getMessages: mockMessageManagerGetMessages,
    setMessages: mockMessageManagerSetMessages,
    getCurrentChat: mockMessageManagerGetCurrentChat,
    initializeNewChat: mockMessageManagerInitializeNewChat,
    forkChat: mockMessageManagerForkChat,
    ensureChatId: mockMessageManagerEnsureChatId,
    addUserMessage: mockMessageManagerAddUserMessage,
    addToolResultMessage: mockMessageManagerAddToolResultMessage,
    replaceOldToolCallResults: mockMessageManagerReplaceOldToolCallResults,
    handleAbort: mockMessageManagerHandleAbort,
    handleError: mockMessageManagerHandleError,
    clearPromptSuggestions: mockMessageManagerClearPromptSuggestions,
    setPromptSuggestions: mockMessageManagerSetPromptSuggestions,
  },
}));

vi.mock('./ContextBuilder', () => ({
  contextBuilder: {
    buildContext: mockContextBuilderBuildContext,
  },
}));

vi.mock('./ToolExecutor', () => ({
  toolExecutor: {
    executeToolCalls: mockToolExecutorExecuteToolCalls,
    isPromptSuggestionsTool: mockToolExecutorIsPromptSuggestionsTool,
    parsePromptSuggestions: mockToolExecutorParsePromptSuggestions,
    filterToolCalls: mockToolExecutorFilterToolCalls,
    isSpecialTool: mockToolExecutorIsSpecialTool,
  },
}));

vi.mock('./AIAPIClient', () => ({
  aiAPIClient: {
    sendRequest: mockAPIClientSendRequest,
  },
}));

// Now import the module under test (after all mocks are set up)
// eslint-disable-next-line import/first
import { aiSession } from './AISession';
// eslint-disable-next-line import/first
import { abortControllerAtom, loadingAtom, pdfImportAtom, webSearchAtom } from '../atoms/aiAnalystAtoms';

// ============================================================================
// Test Helpers
// ============================================================================

const createDefaultRequest = (): AISessionRequest => ({
  messageSource: 'test',
  content: [createTextContent('Hello')],
  context: {} as Context,
  messageIndex: 0,
  importFiles: [],
  connections: [],
});

const createDefaultOptions = () => ({
  modelKey: DEFAULT_BACKUP_MODEL,
  fileUuid: 'test-file-uuid',
  teamUuid: 'test-team-uuid',
});

// ============================================================================
// Tests
// ============================================================================

describe('AISession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStoreData.clear();

    // Set default mock values for store
    mockStoreGet.mockImplementation((atom: unknown) => {
      if (atom === loadingAtom) return false;
      if (atom === pdfImportAtom) return { abortController: undefined, loading: false };
      if (atom === webSearchAtom) return { abortController: undefined, loading: false };
      return mockStoreData.get(atom);
    });

    // Set default mock values for message manager
    mockMessageManagerGetMessages.mockReturnValue([]);
    mockMessageManagerGetCurrentChat.mockReturnValue({
      id: 'test-chat-id',
      name: '',
      lastUpdated: Date.now(),
      messages: [] as ChatMessage[],
    });
    mockMessageManagerReplaceOldToolCallResults.mockReturnValue([]);

    // Set default mock values for context builder
    mockContextBuilderBuildContext.mockImplementation(({ chatMessages }) => Promise.resolve(chatMessages));

    // Set default mock values for tool executor
    mockToolExecutorExecuteToolCalls.mockResolvedValue({
      role: 'user',
      content: [],
      contextType: 'toolResult',
    } as ToolResultMessage);
    mockToolExecutorFilterToolCalls.mockReturnValue([]);
    mockToolExecutorParsePromptSuggestions.mockReturnValue(null);

    // Set default mock values for API client
    mockAPIClientSendRequest.mockResolvedValue({
      error: false,
      content: [],
      toolCalls: [],
    } as AIAPIResponse);
  });

  describe('execute', () => {
    it('returns error when already loading', async () => {
      mockStoreGet.mockImplementation((atom: unknown) => {
        if (atom === loadingAtom) return true; // Already loading
        return undefined;
      });

      const result = await aiSession.execute(createDefaultRequest(), createDefaultOptions());

      expect(result.success).toBe(false);
      expect(result.error).toBe('Already loading');
    });

    it('initializes new chat when messageIndex is 0', async () => {
      await aiSession.execute({ ...createDefaultRequest(), messageIndex: 0 }, createDefaultOptions());

      expect(mockMessageManagerInitializeNewChat).toHaveBeenCalled();
    });

    it('forks chat when messageIndex is less than current message count', async () => {
      const userMessage: UserMessagePrompt = {
        role: 'user',
        content: [createTextContent('Test')],
        contextType: 'userPrompt',
        context: {},
      };
      mockMessageManagerGetCurrentChat.mockReturnValue({
        id: 'test',
        name: '',
        lastUpdated: Date.now(),
        messages: [userMessage, userMessage, userMessage] as ChatMessage[],
      });

      await aiSession.execute({ ...createDefaultRequest(), messageIndex: 1 }, createDefaultOptions());

      expect(mockMessageManagerForkChat).toHaveBeenCalledWith(1);
    });

    it('adds user message to chat', async () => {
      await aiSession.execute(createDefaultRequest(), createDefaultOptions());

      expect(mockMessageManagerAddUserMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          role: 'user',
          contextType: 'userPrompt',
        })
      );
    });

    it('calls importFilesToGrid when import files are provided', async () => {
      const importFilesToGrid = vi.fn();
      const importFiles: ImportFile[] = [{ name: 'test.csv', size: 100, data: new ArrayBuffer(100) }];

      await aiSession.execute(
        { ...createDefaultRequest(), importFiles },
        { ...createDefaultOptions(), importFilesToGrid }
      );

      expect(importFilesToGrid).toHaveBeenCalledWith(
        expect.objectContaining({
          importFiles,
        })
      );
    });

    it('returns success with chatId on successful execution', async () => {
      const result = await aiSession.execute(createDefaultRequest(), createDefaultOptions());

      expect(result.success).toBe(true);
      expect(result.chatId).toBe('test-chat-id');
    });

    it('handles errors and returns failure result', async () => {
      mockContextBuilderBuildContext.mockRejectedValueOnce(new Error('Test error'));

      const result = await aiSession.execute(createDefaultRequest(), createDefaultOptions());

      expect(result.success).toBe(false);
      expect(result.error).toContain('Test error');
      expect(mockMessageManagerHandleError).toHaveBeenCalled();
    });

    it('clears loading state in finally block', async () => {
      await aiSession.execute(createDefaultRequest(), createDefaultOptions());

      // Verify loadingAtom was set to false
      expect(mockStoreSet).toHaveBeenCalledWith(loadingAtom, false);
    });
  });

  describe('buildResolvedContext', () => {
    it('builds context with matching connection', async () => {
      const connections = [
        {
          uuid: 'conn-1',
          name: 'Test Connection',
          type: 'POSTGRES',
          createdDate: new Date().toISOString(),
        },
      ] as Connection[];

      const request: AISessionRequest = {
        ...createDefaultRequest(),
        context: {
          connection: { id: 'conn-1' },
        } as Context,
        connections,
      };

      await aiSession.execute(request, createDefaultOptions());

      expect(mockMessageManagerAddUserMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          context: expect.objectContaining({
            connection: {
              type: 'POSTGRES',
              id: 'conn-1',
              name: 'Test Connection',
            },
          }),
        })
      );
    });

    it('builds context with import files info', async () => {
      const importFiles: ImportFile[] = [
        { name: 'test.csv', size: 100, data: new ArrayBuffer(100) },
        { name: 'data.xlsx', size: 200, data: new ArrayBuffer(200) },
      ];

      await aiSession.execute({ ...createDefaultRequest(), importFiles }, createDefaultOptions());

      expect(mockMessageManagerAddUserMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          context: expect.objectContaining({
            importFiles: {
              prompt: '',
              files: [
                { name: 'test.csv', size: 100 },
                { name: 'data.xlsx', size: 200 },
              ],
            },
          }),
        })
      );
    });
  });

  describe('tool call loop', () => {
    it('processes tool calls and adds results', async () => {
      const toolCalls: AIToolCall[] = [{ id: 'call-1', name: AITool.SetCellValues, arguments: '{}', loading: false }];

      mockAPIClientSendRequest
        .mockResolvedValueOnce({
          error: false,
          content: [],
          toolCalls,
        })
        .mockResolvedValueOnce({
          error: false,
          content: [],
          toolCalls: [],
        });

      await aiSession.execute(createDefaultRequest(), createDefaultOptions());

      expect(mockToolExecutorExecuteToolCalls).toHaveBeenCalled();
      expect(mockMessageManagerAddToolResultMessage).toHaveBeenCalled();
    });

    it('calls getUserPromptSuggestions when no tool calls', async () => {
      const getUserPromptSuggestions = vi.fn();

      mockAPIClientSendRequest.mockResolvedValueOnce({
        error: false,
        content: [],
        toolCalls: [],
      });

      await aiSession.execute(createDefaultRequest(), { ...createDefaultOptions(), getUserPromptSuggestions });

      expect(getUserPromptSuggestions).toHaveBeenCalled();
    });

    it('breaks loop on error response', async () => {
      mockAPIClientSendRequest.mockResolvedValueOnce({
        error: true,
        content: [],
        toolCalls: [],
      });

      await aiSession.execute(createDefaultRequest(), createDefaultOptions());

      // Should only call sendRequest once due to error
      expect(mockAPIClientSendRequest).toHaveBeenCalledTimes(1);
    });

    it('sets prompt suggestions when received from tool call', async () => {
      const toolCalls: AIToolCall[] = [
        { id: 'call-1', name: AITool.UserPromptSuggestions, arguments: '{}', loading: false },
      ];

      mockAPIClientSendRequest.mockResolvedValueOnce({
        error: false,
        content: [],
        toolCalls,
      });

      mockToolExecutorIsPromptSuggestionsTool.mockReturnValue(true);
      mockToolExecutorParsePromptSuggestions.mockReturnValue({
        prompt_suggestions: [{ label: 'Test', prompt: 'Test prompt' }],
      });

      await aiSession.execute(createDefaultRequest(), createDefaultOptions());

      expect(mockMessageManagerSetPromptSuggestions).toHaveBeenCalledWith([{ label: 'Test', prompt: 'Test prompt' }]);
    });
  });

  describe('abort', () => {
    it('aborts the current session', () => {
      const mockAbort = vi.fn();
      mockStoreGet.mockImplementation((atom: unknown) => {
        if (atom === abortControllerAtom) return { abort: mockAbort };
        return undefined;
      });

      aiSession.abort();

      expect(mockAbort).toHaveBeenCalled();
    });

    it('does nothing when no abort controller exists', () => {
      mockStoreGet.mockReturnValue(undefined);

      // Should not throw
      expect(() => aiSession.abort()).not.toThrow();
    });
  });
});

describe('AISession integration scenarios', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStoreData.clear();

    // Set default mock values for store
    mockStoreGet.mockImplementation((atom: unknown) => {
      if (atom === loadingAtom) return false;
      if (atom === pdfImportAtom) return { abortController: undefined, loading: false };
      if (atom === webSearchAtom) return { abortController: undefined, loading: false };
      return mockStoreData.get(atom);
    });

    // Set default mock values for message manager
    mockMessageManagerGetMessages.mockReturnValue([]);
    mockMessageManagerGetCurrentChat.mockReturnValue({
      id: 'test-chat-id',
      name: '',
      lastUpdated: Date.now(),
      messages: [] as ChatMessage[],
    });
    mockMessageManagerReplaceOldToolCallResults.mockReturnValue([]);

    // Set default mock values for context builder
    mockContextBuilderBuildContext.mockImplementation(({ chatMessages }) => Promise.resolve(chatMessages));

    // Set default mock values for tool executor
    mockToolExecutorExecuteToolCalls.mockResolvedValue({
      role: 'user',
      content: [],
      contextType: 'toolResult',
    } as ToolResultMessage);
    mockToolExecutorFilterToolCalls.mockReturnValue([]);
    mockToolExecutorParsePromptSuggestions.mockReturnValue(null);
    mockToolExecutorIsPromptSuggestionsTool.mockReturnValue(false);

    // Set default mock values for API client
    mockAPIClientSendRequest.mockResolvedValue({
      error: false,
      content: [],
      toolCalls: [],
    } as AIAPIResponse);
  });

  it('handles multi-turn conversation with tool calls', async () => {
    let messages: ChatMessage[] = [];
    mockMessageManagerGetMessages.mockImplementation(() => [...messages]);
    mockMessageManagerSetMessages.mockImplementation((newMessages: ChatMessage[]) => {
      messages = [...newMessages];
    });

    // First response has a tool call
    mockAPIClientSendRequest
      .mockResolvedValueOnce({
        error: false,
        content: [{ type: 'text', text: 'Let me set some values' }],
        toolCalls: [{ id: 'call-1', name: AITool.SetCellValues, arguments: '{}', loading: false }],
      })
      .mockResolvedValueOnce({
        error: false,
        content: [{ type: 'text', text: 'Done!' }],
        toolCalls: [],
      });

    const result = await aiSession.execute(createDefaultRequest(), createDefaultOptions());

    expect(result.success).toBe(true);
    expect(mockAPIClientSendRequest).toHaveBeenCalledTimes(2);
    expect(mockToolExecutorExecuteToolCalls).toHaveBeenCalledTimes(1);
  });

  it('handles PDF import tool calls', async () => {
    const importPDF = vi.fn().mockResolvedValue([createTextContent('PDF imported successfully')]);

    mockAPIClientSendRequest
      .mockResolvedValueOnce({
        error: false,
        content: [],
        toolCalls: [
          {
            id: 'pdf-1',
            name: AITool.PDFImport,
            arguments: JSON.stringify({ file_name: 'test.pdf', prompt: 'Extract data' }),
            loading: false,
          },
        ],
      })
      .mockResolvedValueOnce({
        error: false,
        content: [],
        toolCalls: [],
      });

    mockToolExecutorFilterToolCalls.mockImplementation((toolCalls: AIToolCall[], toolName: AITool) =>
      toolCalls.filter((tc) => tc.name === toolName)
    );

    await aiSession.execute(createDefaultRequest(), { ...createDefaultOptions(), importPDF });

    expect(importPDF).toHaveBeenCalled();
  });

  it('handles web search tool calls', async () => {
    const search = vi.fn().mockResolvedValue({
      toolResultContent: [createTextContent('Search results')],
    });

    mockAPIClientSendRequest
      .mockResolvedValueOnce({
        error: false,
        content: [],
        toolCalls: [
          {
            id: 'search-1',
            name: AITool.WebSearch,
            arguments: JSON.stringify({ query: 'test query' }),
            loading: false,
          },
        ],
      })
      .mockResolvedValueOnce({
        error: false,
        content: [],
        toolCalls: [],
      });

    mockToolExecutorFilterToolCalls.mockImplementation((toolCalls: AIToolCall[], toolName: AITool) =>
      toolCalls.filter((tc) => tc.name === toolName)
    );

    await aiSession.execute(createDefaultRequest(), { ...createDefaultOptions(), search });

    expect(search).toHaveBeenCalled();
  });
});
