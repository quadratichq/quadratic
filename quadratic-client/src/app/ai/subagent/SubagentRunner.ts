import { authClient } from '@/auth/auth';
import { apiClient } from '@/shared/api/apiClient';
import { AgentType } from 'quadratic-shared/ai/agents';
import { createTextContent } from 'quadratic-shared/ai/helpers/message.helper';
import { AITool, aiToolsSpec } from 'quadratic-shared/ai/specs/aiToolsSpec';
import { ApiSchemas } from 'quadratic-shared/typesAndSchemas';
import type {
  AIModelKey,
  AIResponseContent,
  AIToolCall,
  ChatMessage,
  ToolResultMessage,
} from 'quadratic-shared/typesAndSchemasAI';
import { subagentSessionManager } from '../session/SubagentSessionManager';
import { aiToolsActions } from '../tools/aiToolsActions';
import { subagentContextBuilder } from './SubagentContextBuilder';
import {
  getSubagentConfig,
  isToolAllowedForSubagent,
  SubagentType,
  type SubagentExecuteOptions,
  type SubagentRange,
  type SubagentResult,
} from './subagentTypes';

/**
 * Map SubagentType to AgentType for API requests.
 */
const SUBAGENT_TO_AGENT_TYPE: Record<SubagentType, AgentType> = {
  [SubagentType.DataFinder]: AgentType.DataFinderSubagent,
  [SubagentType.FormulaCoder]: AgentType.FormulaCoderSubagent,
  [SubagentType.PythonCoder]: AgentType.PythonCoderSubagent,
  [SubagentType.JavascriptCoder]: AgentType.JavascriptCoderSubagent,
  [SubagentType.ConnectionCoder]: AgentType.ConnectionCoderSubagent,
};

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
    } = options;

    const modelKey = modelKeyOverride ?? sessionModelKey;
    const config = getSubagentConfig(subagentType);

    const hasExistingSession = subagentSessionManager.hasSession(subagentType);
    const isResumingSession = hasExistingSession && !reset;

    console.log(
      `[SubagentRunner] ${isResumingSession ? 'Resuming' : 'Starting'} ${subagentType} subagent with model ${modelKey}`
    );

    try {
      let messages: ChatMessage[];

      if (isResumingSession) {
        // Resume existing session: refresh context and add new task
        await subagentSessionManager.refreshContext(subagentType);
        messages = [...subagentSessionManager.getMessages(subagentType)];

        // Add the new task as a user message
        messages.push({
          role: 'user',
          content: [createTextContent(`New task: ${task}${contextHints ? `\n\nHints: ${contextHints}` : ''}`)],
          contextType: 'userPrompt',
        });

        console.log(`[SubagentRunner] Resumed session with ${messages.length} existing messages`);
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
        const isCodingSubagent =
          subagentType === SubagentType.FormulaCoder ||
          subagentType === SubagentType.PythonCoder ||
          subagentType === SubagentType.JavascriptCoder ||
          subagentType === SubagentType.ConnectionCoder;

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
                isCodingSubagent
                  ? 'I understand my role. I will write and debug code until it works correctly.'
                  : 'I understand my role. I will explore the data and provide a summary.'
              ),
            ],
            contextType: 'quadraticDocs',
          },
          ...contextMessages,
        ];
      }

      // Run the tool call loop
      const result = await this.runToolCallLoop({
        messages,
        modelKey,
        fileUuid,
        subagentType,
        maxIterations: config.maxIterations,
        abortSignal,
        onToolCall,
        onToolCallComplete,
      });

      // Persist the updated messages to the session
      subagentSessionManager.setMessages(subagentType, messages);

      // Save the summary if successful
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
   * Note: This modifies the messages array in-place so changes persist
   * back to the caller for session storage.
   */
  private async runToolCallLoop(params: {
    messages: ChatMessage[];
    modelKey: AIModelKey;
    fileUuid: string;
    subagentType: SubagentType;
    maxIterations: number;
    abortSignal?: AbortSignal;
    onToolCall?: SubagentExecuteOptions['onToolCall'];
    onToolCallComplete?: SubagentExecuteOptions['onToolCallComplete'];
  }): Promise<SubagentResult> {
    const { messages, modelKey, fileUuid, subagentType, maxIterations, abortSignal, onToolCall, onToolCallComplete } =
      params;

    let iterations = 0;

    while (iterations < maxIterations) {
      iterations++;
      console.log(`[SubagentRunner] Iteration ${iterations}/${maxIterations}`);

      // Check for abort
      if (abortSignal?.aborted) {
        return { success: false, error: 'Aborted by user' };
      }

      // Send request to API
      const response = await this.sendRequest({
        messages,
        modelKey,
        fileUuid,
        subagentType,
        abortSignal,
      });

      if (response.error) {
        return { success: false, error: 'API request failed' };
      }

      // Add assistant response to messages (mutate in-place for session persistence)
      messages.push({
        role: 'assistant',
        content: response.content,
        contextType: 'userPrompt',
        toolCalls: response.toolCalls,
        modelKey,
      });

      // If no tool calls, the subagent is done
      if (response.toolCalls.length === 0) {
        console.log(`[SubagentRunner] Complete - no more tool calls`);
        return this.parseResult(response.content);
      }

      // Log tool calls
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

      // Execute tool calls
      const toolResultMessage = await this.executeToolCalls(response.toolCalls, subagentType);
      messages.push(toolResultMessage);

      // Emit tool call complete events
      for (const tc of response.toolCalls) {
        onToolCallComplete?.(tc.id);
      }
    }

    // Max iterations reached
    return {
      success: false,
      error: `Max iterations (${maxIterations}) reached`,
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
    abortSignal?: AbortSignal;
  }): Promise<{
    content: AIResponseContent;
    toolCalls: AIToolCall[];
    error?: boolean;
  }> {
    const { messages, modelKey, fileUuid, subagentType, abortSignal } = params;

    try {
      const endpoint = `${apiClient.getApiUrl()}/v0/ai/chat`;
      const token = await authClient.getTokenOrRedirect();

      // Build request body with agent type for proper tool filtering
      const agentType = SUBAGENT_TO_AGENT_TYPE[subagentType];
      const requestBody = {
        chatId: crypto.randomUUID(),
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
      const responseMessage = await this.consumeStreamingResponse(response);
      if (!responseMessage) {
        return { content: [], toolCalls: [], error: true };
      }

      // Filter tool calls to only allowed tools
      const allowedToolCalls = responseMessage.toolCalls.filter((tc) =>
        isToolAllowedForSubagent(subagentType, tc.name as AITool)
      );

      // Log filtered tools
      const filteredCount = responseMessage.toolCalls.length - allowedToolCalls.length;
      if (filteredCount > 0) {
        console.warn(`[SubagentRunner] Filtered ${filteredCount} disallowed tool calls for ${subagentType}`);
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
   */
  private async consumeStreamingResponse(
    response: Response
  ): Promise<{ content: AIResponseContent; toolCalls: AIToolCall[] } | null> {
    const reader = response.body?.getReader();
    if (!reader) {
      console.error('[SubagentRunner] Response body is not readable');
      return null;
    }

    const decoder = new TextDecoder();
    let lastMessage: { content: AIResponseContent; toolCalls: AIToolCall[] } | null = null;

    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const parsed = ApiSchemas['/v0/ai/chat.POST.response'].parse(JSON.parse(line.slice(6)));
              lastMessage = {
                content: parsed.content,
                toolCalls: parsed.toolCalls,
              };
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
  private async executeToolCalls(toolCalls: AIToolCall[], subagentType: SubagentType): Promise<ToolResultMessage> {
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

      const result = await this.executeSingleTool(toolCall);
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
  private async executeSingleTool(toolCall: AIToolCall): Promise<ReturnType<(typeof aiToolsActions)[AITool]>> {
    if (!Object.values(AITool).includes(toolCall.name as AITool)) {
      return [createTextContent('Unknown tool')];
    }

    try {
      const aiTool = toolCall.name as AITool;
      const argsObject = toolCall.arguments ? JSON.parse(toolCall.arguments) : {};
      const args = aiToolsSpec[aiTool].responseSchema.parse(argsObject);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await aiToolsActions[aiTool](args as any, {
        source: 'AIAnalyst',
        chatId: 'subagent',
        messageIndex: 0,
      });

      return result;
    } catch (error) {
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
      const sheetName = match[1] || 'Current Sheet';
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
