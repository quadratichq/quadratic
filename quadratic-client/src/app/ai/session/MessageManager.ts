import {
  createTextContent,
  getMessagesForAI,
  getPromptAndInternalMessages,
  isAIPromptMessage,
  isContentFile,
  removeOldFilesInToolResult,
  replaceOldGetToolCallResults,
} from 'quadratic-shared/ai/helpers/message.helper';
import type {
  AIMessage,
  Chat,
  ChatMessage,
  ToolResultMessage,
  UserMessagePrompt,
} from 'quadratic-shared/typesAndSchemasAI';
import { v4 } from 'uuid';
import {
  aiStore,
  currentChatAtom,
  currentChatMessagesAtom,
  promptSuggestionsAtom,
  showChatHistoryAtom,
} from '../atoms/aiAnalystAtoms';

/**
 * MessageManager handles all chat message operations.
 * It directly manipulates Jotai atoms without React dependencies.
 */
export class MessageManager {
  private store = aiStore;

  /**
   * Get current chat messages
   */
  getMessages(): ChatMessage[] {
    return this.store.get(currentChatMessagesAtom);
  }

  /**
   * Get current chat
   */
  getCurrentChat(): Chat {
    return this.store.get(currentChatAtom);
  }

  /**
   * Set chat messages
   */
  setMessages(messages: ChatMessage[]): void {
    this.store.set(currentChatMessagesAtom, messages);
  }

  /**
   * Add a message to the current chat
   */
  addMessage(message: ChatMessage): void {
    const messages = this.getMessages();
    this.setMessages([...messages, message]);
  }

  /**
   * Update the last message in the chat (in-place).
   * Used by tests and available for callers that need to replace only the last message.
   */
  updateLastMessage(updater: (msg: ChatMessage) => ChatMessage): void {
    const messages = this.getMessages();
    if (messages.length === 0) return;

    const lastMsg = messages[messages.length - 1];
    this.setMessages([...messages.slice(0, -1), updater(lastMsg)]);
  }

  /**
   * Get messages formatted for the AI API
   */
  getMessagesForAI(): ChatMessage[] {
    return getMessagesForAI(this.getMessages());
  }

  /**
   * Get prompt and internal messages only
   */
  getPromptAndInternalMessages(): ChatMessage[] {
    return getPromptAndInternalMessages(this.getMessages());
  }

  /**
   * Initialize a new chat
   */
  initializeNewChat(): string {
    const chatId = v4();
    this.store.set(currentChatAtom, {
      id: chatId,
      name: '',
      lastUpdated: Date.now(),
      messages: [],
    });
    return chatId;
  }

  /**
   * Fork the current chat at a specific message index
   */
  forkChat(atMessageIndex: number): string {
    const currentChat = this.getCurrentChat();
    const chatId = v4();
    this.store.set(currentChatAtom, {
      id: chatId,
      name: '',
      lastUpdated: Date.now(),
      messages: currentChat.messages.slice(0, atMessageIndex).map((msg) => ({ ...msg })),
    });
    return chatId;
  }

  /**
   * Get or create a chat ID
   */
  ensureChatId(): string {
    const currentChat = this.getCurrentChat();
    if (currentChat.id) {
      return currentChat.id;
    }

    const chatId = v4();
    this.store.set(currentChatAtom, {
      ...currentChat,
      id: chatId,
      lastUpdated: Date.now(),
    });
    return chatId;
  }

  /**
   * Add a user prompt message
   */
  addUserMessage(message: UserMessagePrompt): void {
    this.addMessage({ ...message });
  }

  /**
   * Add tool result message and clean up old files
   */
  addToolResultMessage(toolResultMessage: ToolResultMessage): void {
    // Collect file names from the tool result
    const filesInToolResult = toolResultMessage.content.reduce((acc, result) => {
      result.content.forEach((content) => {
        if (isContentFile(content)) {
          acc.add(content.fileName);
        }
      });
      return acc;
    }, new Set<string>());

    // Remove old files and add new tool result
    const messages = this.getMessages();
    const cleanedMessages = removeOldFilesInToolResult(messages, filesInToolResult);
    this.setMessages([...cleanedMessages, toolResultMessage]);
  }

  /**
   * Replace old tool call results with placeholders
   */
  replaceOldToolCallResults(): ChatMessage[] {
    const messages = this.getMessages();
    const updatedMessages = replaceOldGetToolCallResults(messages);
    this.setMessages(updatedMessages);
    return updatedMessages;
  }

  /**
   * Handle abort - update last message with abort text
   */
  handleAbort(modelKey: string, prevWaitingOnMessageIndex: number | undefined): void {
    const messages = this.getMessages();
    const lastMessage = messages.at(-1);

    if (lastMessage && isAIPromptMessage(lastMessage)) {
      const newLastMessage = { ...lastMessage };
      const lastContent = newLastMessage.content.at(-1);
      let currentContent = lastContent?.type === 'text' ? { ...lastContent } : createTextContent('');

      currentContent.text += '\n\nRequest aborted by the user.';
      currentContent.text = currentContent.text.trim();
      newLastMessage.toolCalls = [];
      newLastMessage.content =
        lastContent !== undefined ? [...newLastMessage.content.slice(0, -1), currentContent] : [currentContent];

      this.setMessages([...messages.slice(0, -1), newLastMessage]);
    } else if (lastMessage?.role === 'user') {
      if (prevWaitingOnMessageIndex !== undefined) {
        return;
      }

      const newLastMessage: AIMessage = {
        role: 'assistant',
        content: [createTextContent('Request aborted by the user.')],
        contextType: 'userPrompt',
        toolCalls: [],
        modelKey,
      };
      this.setMessages([...messages, newLastMessage]);
    }
  }

  /**
   * Handle error - update last message with error text
   */
  handleError(modelKey: string): void {
    const messages = this.getMessages();
    const lastMessage = messages.at(-1);

    if (lastMessage && isAIPromptMessage(lastMessage)) {
      const newLastMessage = { ...lastMessage };
      const lastContent = newLastMessage.content.at(-1);
      let currentContent = lastContent?.type === 'text' ? { ...lastContent } : createTextContent('');

      currentContent.text += '\n\nLooks like there was a problem. Please try again.';
      currentContent.text = currentContent.text.trim();
      newLastMessage.toolCalls = [];
      newLastMessage.content =
        lastContent !== undefined ? [...newLastMessage.content.slice(0, -1), currentContent] : [currentContent];

      this.setMessages([...messages.slice(0, -1), newLastMessage]);
    } else if (lastMessage?.role === 'user') {
      const newLastMessage: AIMessage = {
        role: 'assistant',
        content: [createTextContent('Looks like there was a problem. Please try again.')],
        contextType: 'userPrompt',
        toolCalls: [],
        modelKey,
      };
      this.setMessages([...messages, newLastMessage]);
    }
  }

  /**
   * Show the AI Analyst panel and hide chat history
   */
  showAIAnalyst(): void {
    this.store.set(showChatHistoryAtom, false);
  }

  /**
   * Abort and clear prompt suggestions
   */
  clearPromptSuggestions(): void {
    const prev = this.store.get(promptSuggestionsAtom);
    prev.abortController?.abort();
    this.store.set(promptSuggestionsAtom, {
      abortController: undefined,
      suggestions: [],
    });
  }

  /**
   * Set prompt suggestions
   */
  setPromptSuggestions(suggestions: Array<{ label: string; prompt: string }>): void {
    this.store.set(promptSuggestionsAtom, {
      abortController: undefined,
      suggestions,
    });
  }
}

// Singleton instance for easy access
export const messageManager = new MessageManager();
