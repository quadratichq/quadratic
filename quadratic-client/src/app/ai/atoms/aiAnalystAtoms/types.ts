import type { AITool, AIToolsArgs } from 'quadratic-shared/ai/specs/aiToolsSpec';
import type { Chat } from 'quadratic-shared/typesAndSchemasAI';
import type { CategorizedEmptyChatPromptSuggestions } from '@/app/ai/hooks/useGetEmptyChatPromptSuggestions';

/**
 * Type for prompt suggestions extracted from AI tool calls
 */
export type PromptSuggestions = AIToolsArgs[AITool.UserPromptSuggestions]['prompt_suggestions'];

/**
 * State for empty chat suggestions (categorized prompts shown when chat is empty)
 */
export interface EmptyChatSuggestionsState {
  suggestions: CategorizedEmptyChatPromptSuggestions | undefined;
  contextHash: string | undefined;
  loading: boolean;
  abortController: AbortController | undefined;
}

/**
 * State for prompt suggestions with abort controller
 */
export interface PromptSuggestionsState {
  abortController: AbortController | undefined;
  suggestions: PromptSuggestions;
}

/**
 * State for PDF import operations
 */
export interface PdfImportState {
  abortController: AbortController | undefined;
  loading: boolean;
}

/**
 * State for web search operations
 */
export interface WebSearchState {
  abortController: AbortController | undefined;
  loading: boolean;
}

/**
 * State for import files to grid operations
 */
export interface ImportFilesToGridState {
  loading: boolean;
}

/**
 * State for tracking failing SQL connections
 */
export interface FailingSqlConnectionsState {
  uuids: string[];
  lastResetTimestamp: number;
}

/**
 * Creates a new empty chat with a fresh timestamp
 */
export const createDefaultChat = (): Chat => ({
  id: '',
  name: '',
  lastUpdated: Date.now(),
  messages: [],
});
