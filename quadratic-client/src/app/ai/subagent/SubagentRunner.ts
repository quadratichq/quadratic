import { debugFlags } from '@/app/debugFlags/debugFlags';
import { authClient } from '@/auth/auth';
import { apiClient } from '@/shared/api/apiClient';
import { createTextContent } from 'quadratic-shared/ai/helpers/message.helper';
import { AITool } from 'quadratic-shared/ai/specs/aiToolsSpec';
import { ApiSchemas } from 'quadratic-shared/typesAndSchemas';
import type {
  AIModelKey,
  AIResponseContent,
  AIToolCall,
  ChatMessage,
  ToolResultContent,
  ToolResultMessage,
} from 'quadratic-shared/typesAndSchemasAI';
import { subagentSessionManager } from '../session/SubagentSessionManager';
import { executeAIToolFromJson } from '../tools/executeAITool';
import { subagentContextBuilder } from './SubagentContextBuilder';
import type { SubagentType } from './subagentTypes';
import {
  getSubagentConfig,
  isCodingSubagent,
  isToolAllowedForSubagent,
  type SubagentExecuteOptions,
  type SubagentRange,
  type SubagentResult,
} from './subagentTypes';
import { SUBAGENT_TO_AGENT_TYPE } from './subagentTypeToAgentType';

const subagentDebug = () => debugFlags.getFlag('debugShowAISubagent');

/**
 * SubagentRunner executes specialized subagents with isolated context.
 *
 * Subagents:
 * - Have their own persistent message history (managed by SubagentSessionManager)
 * - Are restricted to specific tools based on type
 * - Can use cheaper/faster models
 * - Return summarized results to the main agent
 * - Sessions persist for follow-up questions
 */
export class SubagentRunner {
  /**
   * Execute a subagent and return the result.
   *
   * If a session exists for this subagent type and reset is not true,
   * the session is resumed with refreshed context. Otherwise, a new
   * session is created.
   */
  async execute(options: SubagentExecuteOptions): Promise<SubagentResult> {
    const {
      subagentType,
      task,
      contextHints,
      modelKey: sessionModelKey,
      modelKeyOverride,
      fileUuid,
      abortSignal,
      reset,
      onToolCall,
      onToolCallComplete,
      onStreamProgress,
    } = options;

    const modelKey = modelKeyOverride ?? sessionModelKey;
    const config = getSubagentConfig(subagentType);

    const hasExistingSession = subagentSessionManager.hasSession(subagentType);
    const isResumingSession = hasExistingSession && !reset;

    if (subagentDebug())
      console.log(
        `[SubagentRunner] ${isResumingSession ? 'Resuming' : 'Starting'} ${subagentType} subagent with model ${modelKey}`
      );

    try {
      let messages: ChatMessage[];

      if (isResumingSession) {
        // Resume existing session: refresh context and add new task
        await subagentSessionManager.refreshContext(subagentType, { abortSignal });
        messages = [...subagentSessionManager.getMessages(subagentType)];

        // Add the new task as a user message
        messages.push({
          role: 'user',
          content: [createTextContent(`New task: ${task}${contextHints ? `\n\nHints: ${contextHints}` : ''}`)],
          contextType: 'userPrompt',
        });

        if (subagentDebug()) console.log(`[SubagentRunner] Resumed session with ${messages.length} existing messages`);
      } else {
        // Start fresh session
        if (reset) {
          subagentSessionManager.resetSession(subagentType);
        } else {
          subagentSessionManager.createSession(subagentType);
        }

        // Build context for the subagent
        const contextMessages = await subagentContextBuilder.buildContext(task, contextHints, subagentType);

        // Create initial messages with system prompt
        const codingSubagent = isCodingSubagent(subagentType);

        messages = [
          {
            role: 'user',
            content: [createTextContent(config.systemPrompt)],
            contextType: 'quadraticDocs',
          },
          {
            role: 'assistant',
            content: [
              createTextContent(
                codingSubagent
                  ? 'I understand my role. I will write and debug code until it works correctly.'
                  : 'I understand my role. I will explore the data and provide a summary.'
              ),
            ],
            contextType: 'quadraticDocs',
          },
          ...contextMessages,
        ];
      }

      const session = subagentSessionManager.getSession(subagentType);
      if (!session) {
        throw new Error(`Subagent session not found for ${subagentType}`);
      }

      const { result, finalMessages } = await this.runToolCallLoop({
        messages,
        modelKey,
        fileUuid,
        subagentType,
        chatId: session.id,
        maxIterations: config.maxIterations,
        abortSignal,
        onToolCall,
        onToolCallComplete,
        onStreamProgress,
      });

      subagentSessionManager.setMessages(subagentType, finalMessages);

      if (result.success && result.summary) {
        subagentSessionManager.setLastSummary(subagentType, result.summary);
      }

      return result;
    } catch (error) {
      console.error('[SubagentRunner] Error executing subagent:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Run the main tool call loop for the subagent.
   *
   * Returns the final messages array so the caller can persist atomically.
   * On throw, no finalMessages are returned and the session keeps its prior state.
   */
  private async runToolCallLoop(params: {
    messages: ChatMessage[];
    modelKey: AIModelKey;
    fileUuid: string;
    subagentType: SubagentType;
    chatId: string;
    maxIterations: number;
    abortSignal?: AbortSignal;
    onToolCall?: SubagentExecuteOptions['onToolCall'];
    onToolCallComplete?: SubagentExecuteOptions['onToolCallComplete'];
    onStreamProgress?: SubagentExecuteOptions['onStreamProgress'];
  }): Promise<{ result: SubagentResult; finalMessages: ChatMessage[] }> {
    const {
      messages: initialMessages,
      modelKey,
      fileUuid,
      subagentType,
      chatId,
      maxIterations,
      abortSignal,
      onToolCall,
      onToolCallComplete,
      onStreamProgress,
    } = params;

    const messages = [...initialMessages];
    let iterations = 0;

    while (iterations < maxIterations) {
      iterations++;
      if (subagentDebug()) console.log(`[SubagentRunner] Iteration ${iterations}/${maxIterations}`);

      // Check for abort
      if (abortSignal?.aborted) {
        return { result: { success: false, error: 'Aborted by user' }, finalMessages: messages };
      }

      // Send request to API
      const response = await this.sendRequest({
        messages,
        modelKey,
        fileUuid,
        subagentType,
        chatId,
        abortSignal,
        onStreamProgress,
      });

      if (response.error) {
        return { result: { success: false, error: 'API request failed' }, finalMessages: messages };
      }

      // Add assistant response to messages
      messages.push({
        role: 'assistant',
        content: response.content,
        contextType: 'userPrompt',
        toolCalls: response.toolCalls,
        modelKey,
      });

      // If no tool calls, the subagent is done
      if (response.toolCalls.length === 0) {
        const textContent = response.content
          .filter((c): c is { type: 'text'; text: string } => c.type === 'text')
          .map((c) => c.text)
          .join('\n');
        if (subagentDebug())
          console.log(
            `[SubagentRunner] Complete - no more tool calls. Response text (first 500 chars):`,
            textContent.slice(0, 500)
          );
        return { result: this.parseResult(response.content), finalMessages: messages };
      }

      // Log tool calls
      if (subagentDebug())
        console.log(
          `[SubagentRunner] Tool calls:`,
          response.toolCalls.map((tc) => `${tc.name}(${tc.arguments?.slice(0, 100)}...)`)
        );

      // Emit tool call events for UI (with loading: true)
      for (const tc of response.toolCalls) {
        onToolCall?.({
          id: tc.id,
          name: tc.name,
          arguments: tc.arguments,
          loading: true,
          modelKey, // Include model key for debug display
        });
      }

      // Execute tool calls sequentially. Core is single-process; parallelizing would not improve throughput.
      try {
        const toolResultMessage = await this.executeToolCalls(response.toolCalls, subagentType, chatId);
        messages.push(toolResultMessage);
      } catch (error) {
        messages.pop();
        throw error;
      }

      // Emit tool call complete events
      for (const tc of response.toolCalls) {
        onToolCallComplete?.(tc.id);
      }
    }

    // Max iterations reached
    return {
      result: {
        success: false,
        error: `Max iterations (${maxIterations}) reached`,
      },
      finalMessages: messages,
    };
  }

  /**
   * Send a request to the AI API for the subagent.
   */
  private async sendRequest(params: {
    messages: ChatMessage[];
    modelKey: AIModelKey;
    fileUuid: string;
    subagentType: SubagentType;
    chatId: string;
    abortSignal?: AbortSignal;
    onStreamProgress?: SubagentExecuteOptions['onStreamProgress'];
  }): Promise<{
    content: AIResponseContent;
    toolCalls: AIToolCall[];
    error?: boolean;
  }> {
    const { messages, modelKey, fileUuid, subagentType, chatId, abortSignal, onStreamProgress } = params;

    try {
      const endpoint = `${apiClient.getApiUrl()}/v0/ai/chat`;
      const token = await authClient.getTokenOrRedirect();

      // Build request body with agent type for proper tool filtering
      const agentType = SUBAGENT_TO_AGENT_TYPE[subagentType];
      const requestBody = {
        chatId,
        fileUuid,
        source: 'AIAnalyst',
        messageSource: `subagent:${subagentType}`,
        modelKey,
        messages,
        useStream: true, // Anthropic requires streaming for longer requests
        useToolsPrompt: true,
        useQuadraticContext: true, // API provides language-specific docs based on agentType
        agentType, // Pass agent type for API tool filtering and docs
      };

      const response = await fetch(endpoint, {
        method: 'POST',
        signal: abortSignal,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        console.error('[SubagentRunner] API error:', response.status);
        return { content: [], toolCalls: [], error: true };
      }

      // Handle streaming response (SSE format)
      const responseMessage = await this.consumeStreamingResponse(response, abortSignal, onStreamProgress);
      if (!responseMessage) {
        return { content: [], toolCalls: [], error: true };
      }

      // Log the raw response from the API
      if (subagentDebug())
        console.log(`[SubagentRunner] API response for ${subagentType}:`, {
          contentCount: responseMessage.content.length,
          toolCallCount: responseMessage.toolCalls.length,
          toolCallNames: responseMessage.toolCalls.map((tc) => tc.name),
        });

      // Filter tool calls to only allowed tools
      const allowedToolCalls = responseMessage.toolCalls.filter((tc) =>
        isToolAllowedForSubagent(subagentType, tc.name as AITool)
      );

      // Log filtered tools
      if (subagentDebug()) {
        const filteredCount = responseMessage.toolCalls.length - allowedToolCalls.length;
        if (filteredCount > 0) {
          console.warn(`[SubagentRunner] Filtered ${filteredCount} disallowed tool calls for ${subagentType}:`, {
            original: responseMessage.toolCalls.map((tc) => tc.name),
            allowed: allowedToolCalls.map((tc) => tc.name),
          });
        }
      }

      return {
        content: responseMessage.content,
        toolCalls: allowedToolCalls,
      };
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return { content: [], toolCalls: [], error: true };
      }
      console.error('[SubagentRunner] Request error:', error);
      return { content: [], toolCalls: [], error: true };
    }
  }

  /**
   * Consume a streaming response and return the final message.
   * Optionally invokes onStreamProgress for each parsed chunk so the UI can show progress.
   */
  private async consumeStreamingResponse(
    response: Response,
    abortSignal?: AbortSignal,
    onStreamProgress?: (content: AIResponseContent, toolCalls: AIToolCall[]) => void
  ): Promise<{ content: AIResponseContent; toolCalls: AIToolCall[] } | null> {
    const reader = response.body?.getReader();
    if (!reader) {
      console.error('[SubagentRunner] Response body is not readable');
      return null;
    }

    const decoder = new TextDecoder();
    let lastMessage: { content: AIResponseContent; toolCalls: AIToolCall[] } | null = null;
    let buffer = '';

    try {
      while (true) {
        if (abortSignal?.aborted) break;
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const parsed = ApiSchemas['/v0/ai/chat.POST.response'].parse(JSON.parse(line.slice(6)));
              lastMessage = {
                content: parsed.content,
                toolCalls: parsed.toolCalls,
              };
              onStreamProgress?.(parsed.content, parsed.toolCalls);
            } catch (error) {
              console.warn('[SubagentRunner] Error parsing streaming chunk:', error);
            }
          }
        }
      }
    } catch (error) {
      console.error('[SubagentRunner] Error reading stream:', error);
    } finally {
      reader.releaseLock();
    }

    return lastMessage;
  }

  /**
   * Execute tool calls, filtering to only allowed tools for this subagent type.
   */
  private async executeToolCalls(
    toolCalls: AIToolCall[],
    subagentType: SubagentType,
    chatId: string
  ): Promise<ToolResultMessage> {
    const toolResultMessage: ToolResultMessage = {
      role: 'user',
      content: [],
      contextType: 'toolResult',
    };

    for (const toolCall of toolCalls) {
      // Double-check the tool is allowed (should already be filtered)
      if (!isToolAllowedForSubagent(subagentType, toolCall.name as AITool)) {
        toolResultMessage.content.push({
          id: toolCall.id,
          content: [createTextContent(`Tool '${toolCall.name}' is not allowed for this subagent.`)],
        });
        continue;
      }

      const result = await this.executeSingleTool(toolCall, chatId);
      toolResultMessage.content.push({
        id: toolCall.id,
        content: result,
      });
    }

    return toolResultMessage;
  }

  /**
   * Execute a single tool call.
   */
  private async executeSingleTool(toolCall: AIToolCall, chatId: string): Promise<ToolResultContent> {
    if (!Object.values(AITool).includes(toolCall.name as AITool)) {
      console.warn(`[SubagentRunner] Unknown tool: ${toolCall.name}`);
      return [createTextContent('Unknown tool')];
    }

    try {
      const aiTool = toolCall.name as AITool;
      if (subagentDebug()) console.log(`[SubagentRunner] Executing tool: ${aiTool}`);
      const result = await executeAIToolFromJson(aiTool, toolCall.arguments, {
        source: 'AIAnalyst',
        chatId,
        messageIndex: 0,
      });
      if (subagentDebug())
        console.log(
          `[SubagentRunner] Tool result for ${aiTool}:`,
          result.map((r) => (r.type === 'text' ? r.text.slice(0, 200) : r.type))
        );
      return result;
    } catch (error) {
      console.error(`[SubagentRunner] Error executing ${toolCall.name}:`, error);
      return [createTextContent(`Error executing ${toolCall.name}: ${error}`)];
    }
  }

  /**
   * Parse the final response from the subagent into a structured result.
   */
  private parseResult(content: AIResponseContent): SubagentResult {
    // Extract text content from AIResponseContent array
    const textContent = content
      .filter((c): c is { type: 'text'; text: string } => c.type === 'text')
      .map((c) => c.text)
      .join('\n');

    if (!textContent) {
      return {
        success: false,
        error: 'No response from subagent',
      };
    }

    // Try to extract structured data from the response
    const ranges = this.extractRanges(textContent);

    return {
      success: true,
      summary: textContent,
      ranges: ranges.length > 0 ? ranges : undefined,
      rawContent: textContent,
    };
  }

  /**
   * Extract ranges from the subagent's response.
   * Looks for patterns like "Sheet1!A1:B10" or "A1:B10".
   */
  private extractRanges(text: string): SubagentRange[] {
    const ranges: SubagentRange[] = [];

    // Pattern: SheetName!Range or just Range
    // Examples: Sheet1!A1:F100, 'My Sheet'!A1:B10, A1:C50
    const rangePattern = /(?:['"]?([^'"\n!]+)['"]?!)?([A-Z]+\d+:[A-Z]+\d+)/gi;

    let match;
    while ((match = rangePattern.exec(text)) !== null) {
      const rawSheet = match[1] || 'Current Sheet';
      const sheetName = rawSheet.replace(/^\s*-\s*/, '').trim();
      const range = match[2];

      // Try to extract description from surrounding context
      const contextStart = Math.max(0, match.index - 50);
      const contextEnd = Math.min(text.length, match.index + match[0].length + 100);
      const context = text.slice(contextStart, contextEnd);

      // Look for common patterns like "- SheetName!Range: description" or "contains..."
      const descMatch = context.match(/[:,]\s*([^:\n]+?)(?:\n|$)/);
      const description = descMatch ? descMatch[1].trim() : 'Data range';

      // Avoid duplicates
      if (!ranges.some((r) => r.sheet === sheetName && r.range === range)) {
        ranges.push({
          sheet: sheetName,
          range,
          description,
        });
      }
    }

    return ranges;
  }
}

// Singleton instance
export const subagentRunner = new SubagentRunner();
