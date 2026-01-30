import { sheets } from '@/app/grid/controller/Sheets';
import { aiUser } from '@/app/web-workers/multiplayerWebWorker/aiUser';
import { multiplayer } from '@/app/web-workers/multiplayerWebWorker/multiplayer';
import { trackEvent } from '@/shared/utils/analyticsEvents';
import { getLastAIPromptMessageIndex, getMessagesForAI } from 'quadratic-shared/ai/helpers/message.helper';
import { AITool, aiToolsSpec, type AIToolsArgs } from 'quadratic-shared/ai/specs/aiToolsSpec';
import type {
  AIMessagePrompt,
  AIModelKey,
  ChatMessage,
  Context,
  ToolResultContent,
  ToolResultMessage,
  UserMessagePrompt,
} from 'quadratic-shared/typesAndSchemasAI';
import {
  abortControllerAtom,
  aiStore,
  loadingAtom,
  pdfImportAtom,
  showAIAnalystAtom,
  showChatHistoryAtom,
  waitingOnMessageIndexAtom,
  webSearchAtom,
} from '../atoms/aiAnalystAtoms';
import type { AIAPIClient } from './AIAPIClient';
import { aiAPIClient } from './AIAPIClient';
import type { ContextBuilder } from './ContextBuilder';
import { contextBuilder } from './ContextBuilder';
import type { MessageManager } from './MessageManager';
import { messageManager } from './MessageManager';
import type { ToolExecutor } from './ToolExecutor';
import { toolExecutor } from './ToolExecutor';
import { type AISessionRequest, type AISessionResult, type Connection, type ImportFile } from './types';

const USE_STREAM = true;
const MAX_TOOL_CALL_ITERATIONS = 35;

/**
 * AISession manages the lifecycle of an AI request.
 * This is the central coordinator that replaces useSubmitAIAnalystPrompt.
 */
export class AISession {
  private store = aiStore;
  private contextBuilder: ContextBuilder;
  private toolExecutor: ToolExecutor;
  private messageManager: MessageManager;
  private apiClient: AIAPIClient;

  constructor() {
    this.contextBuilder = contextBuilder;
    this.toolExecutor = toolExecutor;
    this.messageManager = messageManager;
    this.apiClient = aiAPIClient;
  }

  /**
   * Execute an AI session with the given request.
   * Note: This class uses a singleton pattern and is not intended for concurrent
   * executions. The loadingAtom check prevents concurrent calls.
   */
  async execute(
    request: AISessionRequest,
    options: {
      modelKey: AIModelKey;
      fileUuid: string;
      teamUuid: string;
      importFilesToGrid?: (args: { importFiles: ImportFile[]; userMessage: UserMessagePrompt }) => Promise<void>;
      importPDF?: (args: {
        pdfImportArgs: AIToolsArgs[AITool.PDFImport];
        chatMessages: ChatMessage[];
      }) => Promise<ToolResultContent>;
      search?: (args: {
        searchArgs: AIToolsArgs[AITool.WebSearch];
      }) => Promise<{ toolResultContent: ToolResultContent; internal?: ChatMessage }>;
      getUserPromptSuggestions?: () => void;
    }
  ): Promise<AISessionResult> {
    const { messageSource, content, context, messageIndex, importFiles, connections } = request;
    const { modelKey, fileUuid, teamUuid, importFilesToGrid, importPDF, search, getUserPromptSuggestions } = options;

    // Show AI panel and hide chat history
    this.store.set(showAIAnalystAtom, true);
    this.store.set(showChatHistoryAtom, false);

    // Clear prompt suggestions
    this.messageManager.clearPromptSuggestions();

    // Check if already loading
    const previousLoading = this.store.get(loadingAtom);
    if (previousLoading) {
      return { success: false, error: 'Already loading', chatId: '' };
    }

    // Get current message count
    const currentChat = this.messageManager.getCurrentChat();
    const currentMessageCount = currentChat.messages.length;

    // Initialize or fork chat
    if (messageIndex === 0) {
      this.messageManager.initializeNewChat();
    } else if (messageIndex < currentMessageCount) {
      this.messageManager.forkChat(messageIndex);
    }

    // Build context with connection info
    const connectionInContext = connections.find(
      (connection: Connection) => connection.uuid === context.connection?.id
    );
    const resolvedContext: Context = {
      codeCell: context.codeCell,
      connection: connectionInContext
        ? {
            type: connectionInContext.type,
            id: connectionInContext.uuid,
            name: connectionInContext.name,
          }
        : undefined,
      importFiles:
        importFiles.length > 0
          ? {
              prompt: '',
              files: importFiles.map((file: ImportFile) => ({ name: file.name, size: file.size })),
            }
          : undefined,
    };

    // Set up billing limit callback
    const onExceededBillingLimit = (exceededBillingLimit: boolean) => {
      if (!exceededBillingLimit) return;

      const messages = [...this.messageManager.getMessages()];
      messages.pop();
      const currentMessageIndex = messages.length - 1;
      this.messageManager.setMessages(messages);
      this.store.set(waitingOnMessageIndexAtom, currentMessageIndex);

      trackEvent('[Billing].ai.exceededBillingLimit', {
        exceededBillingLimit,
        location: 'AIAnalyst',
      });
    };

    // Set up abort controller
    const abortController = new AbortController();
    abortController.signal.addEventListener(
      'abort',
      () => {
        const prevWaitingOnMessageIndex = this.store.get(waitingOnMessageIndexAtom);
        this.store.set(waitingOnMessageIndexAtom, undefined);

        // Abort sub-operations
        const pdfImport = this.store.get(pdfImportAtom);
        pdfImport.abortController?.abort();
        this.store.set(pdfImportAtom, { abortController: undefined, loading: false });

        const webSearchState = this.store.get(webSearchAtom);
        webSearchState.abortController?.abort();
        this.store.set(webSearchAtom, { abortController: undefined, loading: false });

        // Handle abort in message manager
        this.messageManager.handleAbort(modelKey, prevWaitingOnMessageIndex);
        this.store.set(waitingOnMessageIndexAtom, undefined);
      },
      { once: true }
    );
    this.store.set(abortControllerAtom, abortController);

    // Create and add user message
    const userMessage: UserMessagePrompt = {
      role: 'user',
      content: [...content],
      contextType: 'userPrompt',
      context: { ...resolvedContext },
    };
    this.messageManager.addUserMessage(userMessage);

    // Set loading state
    this.store.set(loadingAtom, true);

    // Initialize AI cursor
    try {
      multiplayer.setAIUser(true);
      const sheetId = sheets.current;
      const jsSelection = sheets.stringToSelection('A1', sheetId);
      const selectionString = jsSelection.save();
      aiUser.updateSelection(selectionString, sheetId);
    } catch (e) {
      console.warn('Failed to initialize AI cursor:', e);
    }

    // Import files to grid if needed
    if (importFilesToGrid && importFiles.length > 0) {
      await importFilesToGrid({ importFiles, userMessage });
    }

    // Get chat ID
    const chatId = this.messageManager.ensureChatId();
    let chatMessages = this.messageManager.getMessages();
    let lastMessageIndex = -1;
    let currentMessageSource = messageSource;

    try {
      // Main tool call loop
      let toolCallIterations = 0;
      while (toolCallIterations < MAX_TOOL_CALL_ITERATIONS) {
        toolCallIterations++;

        // Build context
        chatMessages = await this.contextBuilder.buildContext({
          connections,
          context: resolvedContext,
          chatMessages,
          teamUuid,
        });
        this.messageManager.setMessages(chatMessages);

        const messagesForAI = getMessagesForAI(chatMessages);
        lastMessageIndex = getLastAIPromptMessageIndex(messagesForAI);

        // Send request to API
        const response = await this.apiClient.sendRequest(
          {
            chatId,
            source: 'AIAnalyst',
            messageSource: currentMessageSource,
            modelKey,
            messages: messagesForAI,
            useStream: USE_STREAM,
            toolName: undefined,
            useToolsPrompt: true,
            language: undefined,
            useQuadraticContext: true,
            fileUuid,
          },
          {
            signal: abortController.signal,
            onMessage: (msg) => {
              const messages = this.messageManager.getMessages();
              const lastMessage = messages.at(-1);
              // If last message is user, add new assistant message; otherwise update existing assistant message
              if (lastMessage?.role === 'user') {
                this.messageManager.setMessages([...messages, msg]);
              } else {
                this.messageManager.setMessages([...messages.slice(0, -1), msg]);
              }
            },
            onExceededBillingLimit,
          }
        );

        // Check if waiting on user input
        const waitingOnMsgIndex = this.store.get(waitingOnMessageIndexAtom);
        if (waitingOnMsgIndex !== undefined) {
          break;
        }

        if (response.error) {
          break;
        }

        // Replace old tool call results
        chatMessages = this.messageManager.replaceOldToolCallResults();

        if (abortController.signal.aborted) {
          break;
        }

        if (response.toolCalls.length === 0) {
          getUserPromptSuggestions?.();
          break;
        }

        currentMessageSource = response.toolCalls.map((tc) => tc.name).join(', ');

        // Execute tool calls
        const toolResultMessage: ToolResultMessage = await this.toolExecutor.executeToolCalls(response.toolCalls, {
          source: 'AIAnalyst',
          chatId,
          messageIndex: lastMessageIndex + 1,
        });

        // Check for prompt suggestions
        let promptSuggestions: AIToolsArgs[AITool.UserPromptSuggestions]['prompt_suggestions'] = [];
        for (const toolCall of response.toolCalls) {
          if (this.toolExecutor.isPromptSuggestionsTool(toolCall)) {
            const parsed = this.toolExecutor.parsePromptSuggestions(toolCall);
            if (parsed) {
              promptSuggestions = parsed.prompt_suggestions;
            }
          }
        }

        // Handle PDF import tool calls
        if (importPDF) {
          const pdfToolCalls = this.toolExecutor.filterToolCalls(response.toolCalls, AITool.PDFImport);
          for (const toolCall of pdfToolCalls) {
            const argsObject = toolCall.arguments ? JSON.parse(toolCall.arguments) : {};
            const pdfImportArgs = aiToolsSpec[AITool.PDFImport].responseSchema.parse(argsObject);
            const toolResultContent = await importPDF({ pdfImportArgs, chatMessages });
            toolResultMessage.content.push({
              id: toolCall.id,
              content: toolResultContent,
            });
          }
        }

        // Handle web search tool calls
        if (search) {
          const searchToolCalls = this.toolExecutor.filterToolCalls(response.toolCalls, AITool.WebSearch);
          for (const toolCall of searchToolCalls) {
            const argsObject = toolCall.arguments ? JSON.parse(toolCall.arguments) : {};
            const searchArgs = aiToolsSpec[AITool.WebSearch].responseSchema.parse(argsObject);
            const { toolResultContent, internal } = await search({ searchArgs });
            toolResultMessage.content.push({
              id: toolCall.id,
              content: toolResultContent,
            });

            if (internal) {
              chatMessages = [...this.messageManager.getMessages(), internal];
              this.messageManager.setMessages(chatMessages);
            }
          }
        }

        // Add tool result message
        this.messageManager.addToolResultMessage(toolResultMessage);
        chatMessages = this.messageManager.getMessages();

        // If prompt suggestions, set them and break
        if (promptSuggestions.length > 0) {
          this.messageManager.setPromptSuggestions(promptSuggestions);
          break;
        }
      }

      // Check if we hit the max iterations limit
      if (toolCallIterations >= MAX_TOOL_CALL_ITERATIONS) {
        console.warn(`[AISession] Max tool call iterations (${MAX_TOOL_CALL_ITERATIONS}) reached`);
        // Add an assistant message to inform the user
        const messages = this.messageManager.getMessages();
        const warningMessage: AIMessagePrompt = {
          role: 'assistant',
          content: [
            {
              type: 'text',
              text: 'I reached the maximum number of operations for a single request. You can continue by sending another message.',
            },
          ],
          contextType: 'userPrompt',
          modelKey,
          toolCalls: [],
        };
        this.messageManager.setMessages([...messages, warningMessage]);
      }

      return { success: true, chatId };
    } catch (error) {
      this.messageManager.handleError(modelKey);
      console.error(error);
      return { success: false, error: String(error), chatId };
    } finally {
      this.store.set(abortControllerAtom, undefined);
      this.store.set(loadingAtom, false);
    }
  }

  /**
   * Abort the current session
   */
  abort(): void {
    const controller = this.store.get(abortControllerAtom);
    controller?.abort();
  }
}

// Singleton instance for easy access
export const aiSession = new AISession();
