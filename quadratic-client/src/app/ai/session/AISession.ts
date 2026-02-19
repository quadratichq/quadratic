import { sheets } from '@/app/grid/controller/Sheets';
import { aiUser } from '@/app/web-workers/multiplayerWebWorker/aiUser';
import { multiplayer } from '@/app/web-workers/multiplayerWebWorker/multiplayer';
import { trackEvent } from '@/shared/utils/analyticsEvents';
import { getLastAIPromptMessageIndex, getMessagesForAI } from 'quadratic-shared/ai/helpers/message.helper';
import { AITool, aiToolsSpec, type AIToolsArgs } from 'quadratic-shared/ai/specs/aiToolsSpec';
import type {
  AIMessagePrompt,
  AIModelKey,
  AIToolCall,
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
  loadingWithPersistenceAtom,
  pdfImportAtom,
  showAIAnalystAtom,
  showChatHistoryAtom,
  waitingOnMessageIndexAtom,
  webSearchAtom,
} from '../atoms/aiAnalystAtoms';
import { aiAPIClient } from './AIAPIClient';
import { contextBuilder } from './ContextBuilder';
import { messageManager } from './MessageManager';
import { toolExecutor } from './ToolExecutor';
import type { AIAPIResponse, AISessionRequest, AISessionResult, Connection, ImportFile } from './types';

const USE_STREAM = true;
const MAX_TOOL_CALL_ITERATIONS = 35;

interface ExecuteOptions {
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

interface ToolCallLoopState {
  chatMessages: ChatMessage[];
  currentMessageSource: string;
  lastMessageIndex: number;
}

interface ToolCallLoopContext {
  chatId: string;
  modelKey: AIModelKey;
  fileUuid: string;
  teamUuid: string;
  connections: Connection[];
  resolvedContext: Context;
  abortController: AbortController;
  onExceededBillingLimit: (exceededBillingLimit: boolean) => void;
  importPDF?: ExecuteOptions['importPDF'];
  search?: ExecuteOptions['search'];
  getUserPromptSuggestions?: () => void;
}

/**
 * AISession manages the lifecycle of an AI request.
 * This is the central coordinator that replaces useSubmitAIAnalystPrompt.
 *
 * Dependencies are accessed as module-level singletons rather than instance properties.
 * Tests mock the module exports directly via vi.mock().
 */
export class AISession {
  /**
   * Execute an AI session with the given request.
   */
  async execute(request: AISessionRequest, options: ExecuteOptions): Promise<AISessionResult> {
    const { messageSource, content, context, messageIndex, importFiles, connections } = request;
    const { modelKey, fileUuid, teamUuid, importFilesToGrid, importPDF, search, getUserPromptSuggestions } = options;

    // Prepare session state
    const prepareResult = this.prepareSession(messageIndex);
    if (!prepareResult.success) {
      return { success: false, error: prepareResult.error, chatId: '' };
    }

    // Build resolved context
    const resolvedContext = this.buildResolvedContext(context, connections, importFiles);

    // Set up billing limit callback
    const onExceededBillingLimit = this.createBillingLimitCallback();

    // Set up abort controller
    const abortController = this.setupAbortController(modelKey);

    // Create and add user message
    const userMessage = this.createUserMessage(content, resolvedContext);

    // Initialize AI cursor
    this.initializeAICursor();

    // Import files to grid if needed
    if (importFilesToGrid && importFiles.length > 0) {
      await importFilesToGrid({ importFiles, userMessage });
    }

    // Get chat ID
    const chatId = messageManager.ensureChatId();

    try {
      const loopResult = await this.executeToolCallLoop(
        {
          chatMessages: messageManager.getMessages(),
          currentMessageSource: messageSource,
          lastMessageIndex: -1,
        },
        {
          chatId,
          modelKey,
          fileUuid,
          teamUuid,
          connections,
          resolvedContext,
          abortController,
          onExceededBillingLimit,
          importPDF,
          search,
          getUserPromptSuggestions,
        }
      );

      if (loopResult.reachedMaxIterations) {
        this.handleMaxIterations(modelKey);
      }

      return { success: true, chatId };
    } catch (error) {
      messageManager.handleError(modelKey);
      console.error(error);
      return { success: false, error: String(error), chatId };
    } finally {
      aiStore.set(abortControllerAtom, undefined);
      aiStore.set(loadingWithPersistenceAtom, false);
    }
  }

  /**
   * Prepare the session by setting up UI state and initializing/forking chat
   */
  private prepareSession(messageIndex: number): { success: true } | { success: false; error: string } {
    // Show AI panel and hide chat history
    aiStore.set(showAIAnalystAtom, true);
    aiStore.set(showChatHistoryAtom, false);

    // Clear prompt suggestions
    messageManager.clearPromptSuggestions();

    // Check if already loading
    const previousLoading = aiStore.get(loadingAtom);
    if (previousLoading) {
      return { success: false, error: 'Already loading' };
    }

    // Set loading state immediately to prevent concurrent calls
    aiStore.set(loadingAtom, true);

    // Get current message count
    const currentChat = messageManager.getCurrentChat();
    const currentMessageCount = currentChat.messages.length;

    // Initialize or fork chat
    if (messageIndex === 0) {
      messageManager.initializeNewChat();
    } else if (messageIndex < currentMessageCount) {
      messageManager.forkChat(messageIndex);
    }

    return { success: true };
  }

  /**
   * Build the resolved context with connection and import file info
   */
  private buildResolvedContext(
    context: AISessionRequest['context'],
    connections: Connection[],
    importFiles: ImportFile[]
  ): Context {
    const connectionInContext = connections.find(
      (connection: Connection) => connection.uuid === context.connection?.id
    );

    return {
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
  }

  /**
   * Create the billing limit exceeded callback
   */
  private createBillingLimitCallback(): (exceededBillingLimit: boolean) => void {
    return (exceededBillingLimit: boolean) => {
      if (!exceededBillingLimit) return;

      const messages = [...messageManager.getMessages()];
      messages.pop();
      const currentMessageIndex = messages.length - 1;
      messageManager.setMessages(messages);
      aiStore.set(waitingOnMessageIndexAtom, currentMessageIndex);

      trackEvent('[Billing].ai.exceededBillingLimit', {
        exceededBillingLimit,
        location: 'AIAnalyst',
      });
    };
  }

  /**
   * Set up the abort controller with event listener for cleanup
   */
  private setupAbortController(modelKey: AIModelKey): AbortController {
    const abortController = new AbortController();
    abortController.signal.addEventListener(
      'abort',
      () => {
        const prevWaitingOnMessageIndex = aiStore.get(waitingOnMessageIndexAtom);
        aiStore.set(waitingOnMessageIndexAtom, undefined);

        // Abort sub-operations
        const pdfImport = aiStore.get(pdfImportAtom);
        pdfImport.abortController?.abort();
        aiStore.set(pdfImportAtom, { abortController: undefined, loading: false });

        const webSearchState = aiStore.get(webSearchAtom);
        webSearchState.abortController?.abort();
        aiStore.set(webSearchAtom, { abortController: undefined, loading: false });

        // Handle abort in message manager
        messageManager.handleAbort(modelKey, prevWaitingOnMessageIndex);
      },
      { once: true }
    );
    aiStore.set(abortControllerAtom, abortController);

    return abortController;
  }

  /**
   * Create and add the user message
   */
  private createUserMessage(content: AISessionRequest['content'], resolvedContext: Context): UserMessagePrompt {
    const userMessage: UserMessagePrompt = {
      role: 'user',
      content: [...content],
      contextType: 'userPrompt',
      context: { ...resolvedContext },
    };
    messageManager.addUserMessage(userMessage);
    return userMessage;
  }

  /**
   * Initialize the AI cursor position
   */
  private initializeAICursor(): void {
    try {
      multiplayer.setAIUser(true);
      const sheetId = sheets.current;
      const jsSelection = sheets.stringToSelection('A1', sheetId);
      const selectionString = jsSelection.save();
      aiUser.updateSelection(selectionString, sheetId);
    } catch (e) {
      console.warn('Failed to initialize AI cursor:', e);
    }
  }

  /**
   * Execute the main tool call loop
   */
  private async executeToolCallLoop(
    state: ToolCallLoopState,
    context: ToolCallLoopContext
  ): Promise<{ reachedMaxIterations: boolean }> {
    const { chatId, modelKey, fileUuid, teamUuid, connections, resolvedContext, abortController } = context;
    const { onExceededBillingLimit, importPDF, search, getUserPromptSuggestions } = context;

    let { chatMessages, currentMessageSource, lastMessageIndex } = state;
    let toolCallIterations = 0;

    while (toolCallIterations < MAX_TOOL_CALL_ITERATIONS) {
      toolCallIterations++;

      // Build context
      chatMessages = await contextBuilder.buildContext({
        connections,
        context: resolvedContext,
        chatMessages,
        teamUuid,
      });
      messageManager.setMessages(chatMessages);

      const messagesForAI = getMessagesForAI(chatMessages);
      lastMessageIndex = getLastAIPromptMessageIndex(messagesForAI);

      // Send request to API
      const response = await this.sendAPIRequest({
        chatId,
        modelKey,
        fileUuid,
        currentMessageSource,
        messagesForAI,
        abortController,
        onExceededBillingLimit,
      });

      // Check if we should break the loop
      const shouldBreak = this.checkLoopBreakConditions(response, abortController, getUserPromptSuggestions);
      if (shouldBreak) {
        break;
      }

      // Replace old tool call results
      chatMessages = messageManager.replaceOldToolCallResults();

      currentMessageSource = response.toolCalls.map((tc) => tc.name).join(', ');

      // Process tool calls and get results
      const { toolResultMessage, promptSuggestions, updatedChatMessages } = await this.processToolCalls({
        toolCalls: response.toolCalls,
        chatId,
        lastMessageIndex,
        chatMessages,
        importPDF,
        search,
      });

      chatMessages = updatedChatMessages;

      // Add tool result message
      messageManager.addToolResultMessage(toolResultMessage);
      chatMessages = messageManager.getMessages();

      // If prompt suggestions, set them and break
      if (promptSuggestions.length > 0) {
        messageManager.setPromptSuggestions(promptSuggestions);
        break;
      }
    }

    return { reachedMaxIterations: toolCallIterations >= MAX_TOOL_CALL_ITERATIONS };
  }

  /**
   * Send request to the AI API
   */
  private async sendAPIRequest(params: {
    chatId: string;
    modelKey: AIModelKey;
    fileUuid: string;
    currentMessageSource: string;
    messagesForAI: ChatMessage[];
    abortController: AbortController;
    onExceededBillingLimit: (exceededBillingLimit: boolean) => void;
  }) {
    const { chatId, modelKey, fileUuid, currentMessageSource, messagesForAI, abortController, onExceededBillingLimit } =
      params;

    return aiAPIClient.sendRequest(
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
          const messages = messageManager.getMessages();
          const lastMessage = messages.at(-1);
          // If last message is user, add new assistant message; otherwise update existing assistant message
          if (lastMessage?.role === 'user') {
            messageManager.setMessages([...messages, msg]);
          } else {
            messageManager.setMessages([...messages.slice(0, -1), msg]);
          }
        },
        onExceededBillingLimit,
      }
    );
  }

  /**
   * Check if the tool call loop should break
   */
  private checkLoopBreakConditions(
    response: AIAPIResponse,
    abortController: AbortController,
    getUserPromptSuggestions?: () => void
  ): boolean {
    // Check if waiting on user input
    const waitingOnMsgIndex = aiStore.get(waitingOnMessageIndexAtom);
    if (waitingOnMsgIndex !== undefined) {
      return true;
    }

    if (response.error) {
      return true;
    }

    if (abortController.signal.aborted) {
      return true;
    }

    if (response.toolCalls.length === 0) {
      getUserPromptSuggestions?.();
      return true;
    }

    return false;
  }

  /**
   * Process tool calls and return results
   */
  private async processToolCalls(params: {
    toolCalls: AIToolCall[];
    chatId: string;
    lastMessageIndex: number;
    chatMessages: ChatMessage[];
    importPDF?: ExecuteOptions['importPDF'];
    search?: ExecuteOptions['search'];
  }): Promise<{
    toolResultMessage: ToolResultMessage;
    promptSuggestions: AIToolsArgs[AITool.UserPromptSuggestions]['prompt_suggestions'];
    updatedChatMessages: ChatMessage[];
  }> {
    const { toolCalls, chatId, lastMessageIndex, importPDF, search } = params;
    let chatMessages = params.chatMessages;

    // Execute tool calls
    const toolResultMessage: ToolResultMessage = await toolExecutor.executeToolCalls(toolCalls, {
      source: 'AIAnalyst',
      chatId,
      messageIndex: lastMessageIndex + 1,
    });

    // Check for prompt suggestions
    let promptSuggestions: AIToolsArgs[AITool.UserPromptSuggestions]['prompt_suggestions'] = [];
    for (const toolCall of toolCalls) {
      if (toolExecutor.isPromptSuggestionsTool(toolCall)) {
        const parsed = toolExecutor.parsePromptSuggestions(toolCall);
        if (parsed) {
          promptSuggestions = parsed.prompt_suggestions;
        }
      }
    }

    // Handle PDF import tool calls
    if (importPDF) {
      const pdfToolCalls = toolExecutor.filterToolCalls(toolCalls, AITool.PDFImport);
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
      const searchToolCalls = toolExecutor.filterToolCalls(toolCalls, AITool.WebSearch);
      for (const toolCall of searchToolCalls) {
        const argsObject = toolCall.arguments ? JSON.parse(toolCall.arguments) : {};
        const searchArgs = aiToolsSpec[AITool.WebSearch].responseSchema.parse(argsObject);
        const { toolResultContent, internal } = await search({ searchArgs });
        toolResultMessage.content.push({
          id: toolCall.id,
          content: toolResultContent,
        });

        if (internal) {
          chatMessages = [...messageManager.getMessages(), internal];
          messageManager.setMessages(chatMessages);
        }
      }
    }

    return { toolResultMessage, promptSuggestions, updatedChatMessages: chatMessages };
  }

  /**
   * Handle max iterations reached by adding a warning message
   */
  private handleMaxIterations(modelKey: AIModelKey): void {
    console.warn(`[AISession] Max tool call iterations (${MAX_TOOL_CALL_ITERATIONS}) reached`);
    trackEvent('[AI].maxToolCallIterationsReached', {
      iterations: MAX_TOOL_CALL_ITERATIONS,
      modelKey,
      location: 'AIAnalyst',
    });

    const messages = messageManager.getMessages();
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
    messageManager.setMessages([...messages, warningMessage]);
  }

  /**
   * Abort the current session
   */
  abort(): void {
    const controller = aiStore.get(abortControllerAtom);
    controller?.abort();
  }
}

// Singleton instance for easy access
export const aiSession = new AISession();
