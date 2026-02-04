import { atom } from 'jotai';
import type { Chat } from 'quadratic-shared/typesAndSchemasAI';
import type {
  EmptyChatSuggestionsState,
  FailingSqlConnectionsState,
  ImportFilesToGridState,
  PdfImportState,
  PromptSuggestionsState,
  WebSearchState,
} from './types';
import { createDefaultChat } from './types';

// ============================================================================
// Initialization State
// ============================================================================

/** Whether the AI Analyst has been initialized */
export const aiAnalystInitializedAtom = atom(false);

// ============================================================================
// UI State Atoms
// ============================================================================

/** Whether the AI Analyst panel is visible */
export const showAIAnalystAtom = atom(false);

/** Whether the chat history view is shown */
export const showChatHistoryAtom = atom(false);

/** Active schema connection UUID for SQL context */
export const activeSchemaConnectionUuidAtom = atom<string | undefined>(undefined);

// ============================================================================
// Loading State Atoms
// ============================================================================

/** Whether an AI request is in progress */
export const loadingAtom = atom(false);

/** Abort controller for the current AI request */
export const abortControllerAtom = atom<AbortController | undefined>(undefined);

/** Message index we're waiting on (for billing limit handling) */
export const waitingOnMessageIndexAtom = atom<number | undefined>(undefined);

// ============================================================================
// Chat State Atoms
// ============================================================================

/** All saved chats */
export const chatsAtom = atom<Chat[]>([]);

/** Current active chat (internal base atom) */
export const currentChatBaseAtom = atom<Chat>(createDefaultChat());

// ============================================================================
// Feature State Atoms
// ============================================================================

/** Prompt suggestions state */
export const promptSuggestionsAtom = atom<PromptSuggestionsState>({
  abortController: undefined,
  suggestions: [],
});

/** PDF import operation state */
export const pdfImportAtom = atom<PdfImportState>({
  abortController: undefined,
  loading: false,
});

/** Web search operation state */
export const webSearchAtom = atom<WebSearchState>({
  abortController: undefined,
  loading: false,
});

/** Import files to grid operation state */
export const importFilesToGridAtom = atom<ImportFilesToGridState>({
  loading: false,
});

/** Failing SQL connections tracking */
export const failingSqlConnectionsAtom = atom<FailingSqlConnectionsState>({
  uuids: [],
  lastResetTimestamp: 0,
});

/** Empty chat suggestions state (categorized prompts shown when chat is empty) */
export const emptyChatSuggestionsAtom = atom<EmptyChatSuggestionsState>({
  suggestions: undefined,
  contextHash: undefined,
  loading: false,
  abortController: undefined,
});
