import { AgentType, getDisabledToolsForAgent, isToolAllowedForAgent } from 'quadratic-shared/ai/agents';
import { createTextContent } from 'quadratic-shared/ai/helpers/message.helper';
import { AITool, aiToolsSpec } from 'quadratic-shared/ai/specs/aiToolsSpec';
import type { AIToolCall, ToolResultContent, ToolResultMessage } from 'quadratic-shared/typesAndSchemasAI';
import { executeAIToolFromJson } from '../tools/executeAITool';
import type { ToolExecutionOptions } from './types';

/**
 * ToolExecutor handles the execution of AI tool calls.
 * This is a pure class with no React dependencies.
 */
export class ToolExecutor {
  /**
   * Execute multiple tool calls and return a tool result message
   */
  async executeToolCalls(toolCalls: AIToolCall[], options: ToolExecutionOptions): Promise<ToolResultMessage> {
    const toolResultMessage: ToolResultMessage = {
      role: 'user',
      content: [],
      contextType: 'toolResult',
    };

    for (const toolCall of toolCalls) {
      // Skip special tools that are handled separately (PDF import, web search)
      if (toolCall.name === AITool.PDFImport || toolCall.name === AITool.WebSearch) {
        continue;
      }

      const result = await this.executeSingleTool(toolCall, options);
      toolResultMessage.content.push({
        id: toolCall.id,
        content: result,
      });
    }

    return toolResultMessage;
  }

  /**
   * Execute a single tool call
   */
  async executeSingleTool(toolCall: AIToolCall, options: ToolExecutionOptions): Promise<ToolResultContent> {
    // Check if it's a valid AI tool
    if (!Object.values(AITool).includes(toolCall.name as AITool)) {
      return [createTextContent('Unknown tool')];
    }

    const aiTool = toolCall.name as AITool;

    // Check if tool is allowed for the current agent type
    const agentType = options.agentType ?? AgentType.MainAgent;
    if (!isToolAllowedForAgent(agentType, aiTool)) {
      const disabledTools = getDisabledToolsForAgent(agentType);
      const isDataTool = disabledTools.includes(aiTool);
      // Internal message - AI should not repeat this to the user
      const message = isDataTool
        ? `[Internal: Use delegate_to_subagent with type "data_finder" instead. Do not mention this redirect to the user.]`
        : `[Internal: Tool not available. Do not mention this to the user.]`;
      return [createTextContent(message)];
    }

    try {
      return await executeAIToolFromJson(aiTool, toolCall.arguments, {
        source: options.source,
        chatId: options.chatId,
        messageIndex: options.messageIndex,
        fileUuid: options.fileUuid,
        teamUuid: options.teamUuid,
        modelKey: options.modelKey,
        abortSignal: options.abortSignal,
      });
    } catch (error) {
      return [createTextContent(`Error parsing ${toolCall.name} tool's arguments: ${error}`)];
    }
  }

  /**
   * Check if a tool call is for a special handler (PDF import, web search)
   */
  isSpecialTool(toolCall: AIToolCall): boolean {
    return toolCall.name === AITool.PDFImport || toolCall.name === AITool.WebSearch;
  }

  /**
   * Get tool calls filtered by type
   */
  filterToolCalls(toolCalls: AIToolCall[], toolName: AITool): AIToolCall[] {
    return toolCalls.filter((tc) => tc.name === toolName);
  }

  /**
   * Check if a tool call is for user prompt suggestions
   */
  isPromptSuggestionsTool(toolCall: AIToolCall): boolean {
    return toolCall.name === AITool.UserPromptSuggestions;
  }

  /**
   * Parse prompt suggestions from a tool call
   */
  parsePromptSuggestions(
    toolCall: AIToolCall
  ): { prompt_suggestions: Array<{ label: string; prompt: string }> } | null {
    if (toolCall.name !== AITool.UserPromptSuggestions) {
      return null;
    }

    try {
      const argsObject = toolCall.arguments ? JSON.parse(toolCall.arguments) : {};
      return aiToolsSpec[AITool.UserPromptSuggestions].responseSchema.parse(argsObject);
    } catch {
      return null;
    }
  }
}

// Singleton instance for easy access
export const toolExecutor = new ToolExecutor();
