import type { AITool, AIToolsArgsSchema } from 'quadratic-shared/ai/specs/aiToolsSpec';
import type { Chat } from 'quadratic-shared/typesAndSchemasAI';
import type { z } from 'zod';

/**
 * Type for prompt suggestions extracted from AI tool calls
 */
export type PromptSuggestions = z.infer<(typeof AIToolsArgsSchema)[AITool.UserPromptSuggestions]>['prompt_suggestions'];

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
 * Default empty chat
 */
export const defaultChat: Chat = {
  id: '',
  name: '',
  lastUpdated: Date.now(),
  messages: [],
};
