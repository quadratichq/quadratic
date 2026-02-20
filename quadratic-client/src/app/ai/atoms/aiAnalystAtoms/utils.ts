import { isAIPromptMessage, isToolResultMessage } from 'quadratic-shared/ai/helpers/message.helper';
import { AITool, aiToolsSpec } from 'quadratic-shared/ai/specs/aiToolsSpec';
import type { Chat } from 'quadratic-shared/typesAndSchemasAI';
import type { PromptSuggestions } from './types';

/**
 * Extract prompt suggestions from the last AI message in a chat
 */
export function extractPromptSuggestionsFromChat(chat: Chat): PromptSuggestions {
  const lastMessage = chat.messages.at(-1);
  const secondToLastMessage = chat.messages.at(-2);

  // If last message is a tool result, look at the second-to-last message
  const lastAIMessage = lastMessage && isToolResultMessage(lastMessage) ? secondToLastMessage : lastMessage;

  if (!lastAIMessage || !isAIPromptMessage(lastAIMessage)) {
    return [];
  }

  const promptSuggestion = lastAIMessage.toolCalls
    .filter(
      (toolCall) => toolCall.name === AITool.UserPromptSuggestions && toolCall.arguments.length > 0 && !toolCall.loading
    )
    .at(-1);

  if (!promptSuggestion) {
    return [];
  }

  try {
    const argsObject = JSON.parse(promptSuggestion.arguments);
    return aiToolsSpec[AITool.UserPromptSuggestions].responseSchema.parse(argsObject).prompt_suggestions;
  } catch {
    return [];
  }
}
