import { authClient } from '@/auth/auth';
import { apiClient } from '@/shared/api/apiClient';
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
import { aiToolsActions } from '../tools/aiToolsActions';
import { subagentContextBuilder } from './SubagentContextBuilder';
import {
  getSubagentConfig,
  isToolAllowedForSubagent,
  type SubagentExecuteOptions,
  type SubagentRange,
  type SubagentResult,
  type SubagentType,
} from './subagentTypes';

/**
 * SubagentRunner executes specialized subagents with isolated context.
 *
 * Subagents:
 * - Have their own message history (don't inherit main conversation)
 * - Are restricted to specific tools based on type
 * - Can use cheaper/faster models
 * - Return summarized results to the main agent
 */
export class SubagentRunner {
  /**
   * Execute a subagent and return the result.
   */
  async execute(options: SubagentExecuteOptions): Promise<SubagentResult> {
    const { subagentType, task, contextHints, modelKeyOverride, fileUuid, abortSignal } = options;

    const config = getSubagentConfig(subagentType);
    const modelKey = modelKeyOverride ?? config.defaultModelKey;

    console.log(`[SubagentRunner] Starting ${subagentType} subagent with model ${modelKey}`);

    try {
      // Build context for the subagent
      const contextMessages = await subagentContextBuilder.buildContext(task, contextHints);

      // Create initial messages with system prompt
      const messages: ChatMessage[] = [
        {
          role: 'user',
          content: [createTextContent(config.systemPrompt)],
          contextType: 'quadraticDocs',
        },
        {
          role: 'assistant',
          content: [createTextContent('I understand my role. I will explore the data and provide a summary.')],
          contextType: 'quadraticDocs',
        },
        ...contextMessages,
      ];

      // Run the tool call loop
      const result = await this.runToolCallLoop({
        messages,
        modelKey,
        fileUuid,
        subagentType,
        maxIterations: config.maxIterations,
        abortSignal,
      });

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
   */
  private async runToolCallLoop(params: {
    messages: ChatMessage[];
    modelKey: AIModelKey;
    fileUuid: string;
    subagentType: SubagentType;
    maxIterations: number;
    abortSignal?: AbortSignal;
  }): Promise<SubagentResult> {
    const { messages, modelKey, fileUuid, subagentType, maxIterations, abortSignal } = params;

    let iterations = 0;
    const currentMessages = [...messages];

    while (iterations < maxIterations) {
      iterations++;

      // Check for abort
      if (abortSignal?.aborted) {
        return { success: false, error: 'Aborted by user' };
      }

      // Send request to API
      const response = await this.sendRequest({
        messages: currentMessages,
        modelKey,
        fileUuid,
        subagentType,
        abortSignal,
      });

      if (response.error) {
        return { success: false, error: 'API request failed' };
      }

      // Add assistant response to messages
      currentMessages.push({
        role: 'assistant',
        content: response.content,
        contextType: 'userPrompt',
        toolCalls: response.toolCalls,
        modelKey,
      });

      // If no tool calls, the subagent is done
      if (response.toolCalls.length === 0) {
        return this.parseResult(response.content);
      }

      // Execute tool calls
      const toolResultMessage = await this.executeToolCalls(response.toolCalls, subagentType);
      currentMessages.push(toolResultMessage);
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

      // Build request body with filtered tool specs
      // Note: The API will use the tools based on useToolsPrompt
      // We filter on our end when executing tool calls
      const requestBody = {
        chatId: crypto.randomUUID(),
        fileUuid,
        source: 'AIAnalyst',
        messageSource: `subagent:${subagentType}`,
        modelKey,
        messages,
        useStream: false, // Subagents don't stream
        useToolsPrompt: true,
        useQuadraticContext: false, // Context is already built
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

      const data = await response.json();
      const responseMessage = ApiSchemas['/v0/ai/chat.POST.response'].parse(data);

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
