import { isAIPromptMessage, isToolResultMessage } from 'quadratic-shared/ai/helpers/message.helper';
import type { ChatMessage } from 'quadratic-shared/typesAndSchemasAI';

/**
 * Collects valid tool call IDs and existing tool result IDs from prompt messages.
 * Used to filter out orphaned tool_use blocks (e.g., when chat is forked mid-tool-call)
 * and orphaned tool_result blocks (e.g., when user aborts mid-tool-call).
 */
export function getOrphanFilterIds(promptMessages: ChatMessage[]): {
  validToolCallIds: Set<string>;
  existingToolResultIds: Set<string>;
} {
  const validToolCallIds = new Set<string>();
  for (const message of promptMessages) {
    if (isAIPromptMessage(message)) {
      for (const toolCall of message.toolCalls) {
        validToolCallIds.add(toolCall.id);
      }
    }
  }

  const existingToolResultIds = new Set<string>();
  for (const message of promptMessages) {
    if (isToolResultMessage(message)) {
      for (const toolResult of message.content) {
        existingToolResultIds.add(toolResult.id);
      }
    }
  }

  return { validToolCallIds, existingToolResultIds };
}
