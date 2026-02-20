import { createTextContent } from 'quadratic-shared/ai/helpers/message.helper';
import type {
  AIMessagePrompt,
  Chat,
  ChatMessage,
  ToolResultMessage,
  UserMessagePrompt,
} from 'quadratic-shared/typesAndSchemasAI';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MessageManager } from './MessageManager';

// Create mock store for testing
const createMockStore = () => {
  const store = new Map<unknown, unknown>();
  return {
    get: vi.fn((atom: unknown) => store.get(atom)),
    set: vi.fn((atom: unknown, value: unknown) => store.set(atom, value)),
    _store: store,
  };
};

describe('MessageManager', () => {
  let messageManager: MessageManager;
  let mockStore: ReturnType<typeof createMockStore>;

  const createUserMessage = (text: string): UserMessagePrompt => ({
    role: 'user',
    content: [createTextContent(text)],
    contextType: 'userPrompt',
    context: {},
  });

  const createAssistantMessage = (text: string, modelKey = 'anthropic:claude-sonnet-4-20250514'): AIMessagePrompt => ({
    role: 'assistant',
    content: [createTextContent(text)],
    contextType: 'userPrompt',
    modelKey,
    toolCalls: [],
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockStore = createMockStore();
    messageManager = new MessageManager();
    // @ts-expect-error - accessing private property for testing
    messageManager.store = mockStore;
  });

  describe('getMessages / setMessages', () => {
    it('gets messages from store', () => {
      const messages: ChatMessage[] = [createUserMessage('Hello')];
      mockStore.get.mockReturnValue(messages);

      const result = messageManager.getMessages();

      expect(result).toEqual(messages);
    });

    it('sets messages in store', () => {
      const messages: ChatMessage[] = [createUserMessage('Hello')];

      messageManager.setMessages(messages);

      expect(mockStore.set).toHaveBeenCalledWith(expect.anything(), messages);
    });
  });

  describe('getCurrentChat', () => {
    it('gets current chat from store', () => {
      const chat: Chat = {
        id: 'test-id',
        name: 'Test Chat',
        lastUpdated: Date.now(),
        messages: [],
      };
      mockStore.get.mockReturnValue(chat);

      const result = messageManager.getCurrentChat();

      expect(result).toEqual(chat);
    });
  });

  describe('addMessage', () => {
    it('adds message to existing messages', () => {
      const existingMessages: ChatMessage[] = [createUserMessage('First')];
      mockStore.get.mockReturnValue(existingMessages);

      const newMessage = createAssistantMessage('Response');
      messageManager.addMessage(newMessage);

      expect(mockStore.set).toHaveBeenCalledWith(expect.anything(), [...existingMessages, newMessage]);
    });

    it('adds message to empty messages array', () => {
      mockStore.get.mockReturnValue([]);

      const newMessage = createUserMessage('Hello');
      messageManager.addMessage(newMessage);

      expect(mockStore.set).toHaveBeenCalledWith(expect.anything(), [newMessage]);
    });
  });

  describe('updateLastMessage', () => {
    it('updates the last message in the array', () => {
      const messages: ChatMessage[] = [createUserMessage('First'), createAssistantMessage('Second')];
      mockStore.get.mockReturnValue(messages);

      messageManager.updateLastMessage((msg) => {
        if (msg.role === 'assistant') {
          return { ...msg, content: [createTextContent('Updated')] };
        }
        return msg;
      });

      expect(mockStore.set).toHaveBeenCalledWith(
        expect.anything(),
        expect.arrayContaining([
          expect.objectContaining({ content: [createTextContent('First')] }),
          expect.objectContaining({ content: [createTextContent('Updated')] }),
        ])
      );
    });

    it('does nothing when messages array is empty', () => {
      mockStore.get.mockReturnValue([]);

      messageManager.updateLastMessage((msg) => msg);

      expect(mockStore.set).not.toHaveBeenCalled();
    });
  });

  describe('initializeNewChat', () => {
    it('creates a new chat with empty messages', () => {
      const chatId = messageManager.initializeNewChat();

      expect(chatId).toBeDefined();
      expect(typeof chatId).toBe('string');
      expect(mockStore.set).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          id: expect.any(String),
          name: '',
          messages: [],
        })
      );
    });
  });

  describe('forkChat', () => {
    it('creates a new chat with messages up to the specified index', () => {
      const messages: ChatMessage[] = [
        createUserMessage('First'),
        createAssistantMessage('Second'),
        createUserMessage('Third'),
      ];
      const chat: Chat = {
        id: 'original-id',
        name: 'Original',
        lastUpdated: Date.now(),
        messages,
      };
      mockStore.get.mockReturnValue(chat);

      const newChatId = messageManager.forkChat(2);

      expect(newChatId).toBeDefined();
      expect(mockStore.set).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          id: expect.any(String),
          name: '',
          messages: expect.arrayContaining([
            expect.objectContaining({ content: [createTextContent('First')] }),
            expect.objectContaining({ content: [createTextContent('Second')] }),
          ]),
        })
      );
    });

    it('creates empty messages when forking at index 0', () => {
      const chat: Chat = {
        id: 'original-id',
        name: 'Original',
        lastUpdated: Date.now(),
        messages: [createUserMessage('First')],
      };
      mockStore.get.mockReturnValue(chat);

      messageManager.forkChat(0);

      expect(mockStore.set).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          messages: [],
        })
      );
    });
  });

  describe('ensureChatId', () => {
    it('returns existing chat ID if present', () => {
      const chat: Chat = {
        id: 'existing-id',
        name: 'Test',
        lastUpdated: Date.now(),
        messages: [],
      };
      mockStore.get.mockReturnValue(chat);

      const chatId = messageManager.ensureChatId();

      expect(chatId).toBe('existing-id');
    });

    it('creates new chat ID if not present', () => {
      const chat: Chat = {
        id: '',
        name: 'Test',
        lastUpdated: Date.now(),
        messages: [],
      };
      mockStore.get.mockReturnValue(chat);

      const chatId = messageManager.ensureChatId();

      expect(chatId).toBeDefined();
      expect(chatId).not.toBe('');
      expect(mockStore.set).toHaveBeenCalled();
    });
  });

  describe('addUserMessage', () => {
    it('adds a user message to the chat', () => {
      mockStore.get.mockReturnValue([]);

      const userMessage = createUserMessage('Hello');
      messageManager.addUserMessage(userMessage);

      expect(mockStore.set).toHaveBeenCalledWith(
        expect.anything(),
        expect.arrayContaining([expect.objectContaining({ role: 'user' })])
      );
    });
  });

  describe('addToolResultMessage', () => {
    it('adds tool result message to the chat', () => {
      mockStore.get.mockReturnValue([createUserMessage('Hello')]);

      const toolResultMessage: ToolResultMessage = {
        role: 'user',
        content: [{ id: 'tool-1', content: [createTextContent('Result')] }],
        contextType: 'toolResult',
      };

      messageManager.addToolResultMessage(toolResultMessage);

      expect(mockStore.set).toHaveBeenCalled();
    });
  });

  describe('handleAbort', () => {
    it('appends abort message to last assistant message', () => {
      const messages: ChatMessage[] = [createUserMessage('Hello'), createAssistantMessage('Processing...')];
      mockStore.get.mockReturnValue(messages);

      messageManager.handleAbort('anthropic:claude-sonnet-4-20250514', undefined);

      expect(mockStore.set).toHaveBeenCalledWith(
        expect.anything(),
        expect.arrayContaining([
          expect.objectContaining({
            content: expect.arrayContaining([
              expect.objectContaining({
                text: expect.stringContaining('Request aborted by the user'),
              }),
            ]),
          }),
        ])
      );
    });

    it('creates new assistant message when last message is user', () => {
      const messages: ChatMessage[] = [createUserMessage('Hello')];
      mockStore.get.mockReturnValue(messages);

      messageManager.handleAbort('anthropic:claude-sonnet-4-20250514', undefined);

      expect(mockStore.set).toHaveBeenCalledWith(
        expect.anything(),
        expect.arrayContaining([
          expect.objectContaining({ role: 'user' }),
          expect.objectContaining({
            role: 'assistant',
            content: expect.arrayContaining([
              expect.objectContaining({
                text: 'Request aborted by the user.',
              }),
            ]),
          }),
        ])
      );
    });

    it('does not create abort message when waiting on previous message', () => {
      const messages: ChatMessage[] = [createUserMessage('Hello')];
      mockStore.get.mockReturnValue(messages);

      messageManager.handleAbort('anthropic:claude-sonnet-4-20250514', 0);

      // Should not add abort message when prevWaitingOnMessageIndex is defined
      // handleAbort returns early, so set should not be called
      expect(mockStore.set).not.toHaveBeenCalled();
    });
  });

  describe('handleError', () => {
    it('appends error message to last assistant message', () => {
      const messages: ChatMessage[] = [createUserMessage('Hello'), createAssistantMessage('Processing...')];
      mockStore.get.mockReturnValue(messages);

      messageManager.handleError('anthropic:claude-sonnet-4-20250514');

      expect(mockStore.set).toHaveBeenCalledWith(
        expect.anything(),
        expect.arrayContaining([
          expect.objectContaining({
            content: expect.arrayContaining([
              expect.objectContaining({
                text: expect.stringContaining('Looks like there was a problem'),
              }),
            ]),
          }),
        ])
      );
    });

    it('creates new assistant message when last message is user', () => {
      const messages: ChatMessage[] = [createUserMessage('Hello')];
      mockStore.get.mockReturnValue(messages);

      messageManager.handleError('anthropic:claude-sonnet-4-20250514');

      expect(mockStore.set).toHaveBeenCalledWith(
        expect.anything(),
        expect.arrayContaining([
          expect.objectContaining({ role: 'user' }),
          expect.objectContaining({
            role: 'assistant',
            content: expect.arrayContaining([
              expect.objectContaining({
                text: 'Looks like there was a problem. Please try again.',
              }),
            ]),
          }),
        ])
      );
    });
  });

  describe('clearPromptSuggestions', () => {
    it('aborts previous controller and clears suggestions', () => {
      const mockAbortController = { abort: vi.fn() };
      mockStore.get.mockReturnValue({ abortController: mockAbortController, suggestions: ['test'] });

      messageManager.clearPromptSuggestions();

      expect(mockAbortController.abort).toHaveBeenCalled();
      expect(mockStore.set).toHaveBeenCalledWith(expect.anything(), {
        abortController: undefined,
        suggestions: [],
      });
    });

    it('handles missing abort controller gracefully', () => {
      mockStore.get.mockReturnValue({ abortController: undefined, suggestions: [] });

      expect(() => messageManager.clearPromptSuggestions()).not.toThrow();
    });
  });

  describe('setPromptSuggestions', () => {
    it('sets prompt suggestions in store', () => {
      const suggestions = [
        { label: 'Test 1', prompt: 'Prompt 1' },
        { label: 'Test 2', prompt: 'Prompt 2' },
      ];

      messageManager.setPromptSuggestions(suggestions);

      expect(mockStore.set).toHaveBeenCalledWith(expect.anything(), {
        abortController: undefined,
        suggestions,
      });
    });
  });
});
