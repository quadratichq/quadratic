/**
 * AI Analyst Atoms - Modular state management for the AI Analyst feature
 *
 * File structure:
 * - store.ts      - Jotai store for vanilla JS access
 * - types.ts      - Type definitions and default values
 * - primitives.ts - Base atoms (simple state containers)
 * - chatAtoms.ts  - Chat-related derived atoms
 * - selectors.ts  - Read-only computed atoms
 * - actions.ts    - Action functions with side effects
 * - utils.ts      - Helper functions
 */

// Store
export { aiStore } from './store';

// Types
export { createDefaultChat } from './types';
export type {
  EmptyChatSuggestionsState,
  FailingSqlConnectionsState,
  ImportFilesToGridState,
  PdfImportState,
  PromptSuggestions,
  PromptSuggestionsState,
  WebSearchState,
} from './types';

// Primitive atoms
export {
  abortControllerAtom,
  activeSchemaConnectionUuidAtom,
  aiAnalystInitializedAtom,
  chatsAtom,
  currentChatBaseAtom,
  emptyChatSuggestionsAtom,
  failingSqlConnectionsAtom,
  importFilesToGridAtom,
  loadingAtom,
  pdfImportAtom,
  promptSuggestionsAtom,
  showAIAnalystAtom,
  showChatHistoryAtom,
  waitingOnMessageIndexAtom,
  webSearchAtom,
} from './primitives';

// Chat atoms
export { currentChatAtom, currentChatMessagesAtom, currentChatNameAtom } from './chatAtoms';

// Selectors
export {
  chatsCountAtom,
  currentChatMessagesCountAtom,
  currentChatUserMessagesCountAtom,
  emptyChatSuggestionsLoadingAtom,
  importFilesToGridLoadingAtom,
  pdfImportLoadingAtom,
  promptSuggestionsCountAtom,
  promptSuggestionsLoadingAtom,
  webSearchLoadingAtom,
} from './selectors';

// Effect atoms (atoms with side effects in setters)
export {
  chatsWithPersistenceAtom,
  loadingWithPersistenceAtom,
  showAIAnalystWithEffectsAtom,
  showChatHistoryWithEffectsAtom,
} from './effectAtoms';

// Actions (for vanilla JS usage)
export {
  getAIAnalystInitialized,
  getShowAIAnalyst,
  initializeAIAnalyst,
  resetAIAnalystInitialized,
  saveChatName,
  setLoadingWithPersistence,
  setShowAIAnalyst,
  setShowChatHistory,
  toggleShowAIAnalyst,
  updateChatsWithPersistence,
} from './actions';

// Utils
export { extractPromptSuggestionsFromChat } from './utils';
