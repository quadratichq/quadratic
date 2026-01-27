// AI Analyst Jotai Atoms
// These atoms replace the Recoil atoms from @/app/atoms/aiAnalystAtom

export {
  // Store for vanilla JS access
  aiStore,
  // Base atoms
  showAIAnalystAtom,
  showChatHistoryAtom,
  loadingAtom,
  abortControllerAtom,
  activeSchemaConnectionUuidAtom,
  waitingOnMessageIndexAtom,
  failingSqlConnectionsAtom,
  // Chat state
  chatsAtom,
  currentChatAtom,
  currentChatNameAtom,
  currentChatMessagesAtom,
  // Feature state
  promptSuggestionsAtom,
  pdfImportAtom,
  webSearchAtom,
  importFilesToGridAtom,
  // Derived atoms (read-only)
  chatsCountAtom,
  currentChatMessagesCountAtom,
  currentChatUserMessagesCountAtom,
  promptSuggestionsCountAtom,
  promptSuggestionsLoadingAtom,
  pdfImportLoadingAtom,
  webSearchLoadingAtom,
  importFilesToGridLoadingAtom,
  // Atoms with side effects (use these in React components)
  chatsWithPersistenceAtom,
  loadingWithPersistenceAtom,
  showAIAnalystWithEffectsAtom,
  showChatHistoryWithEffectsAtom,
  // Initialization
  getAIAnalystInitialized,
  initializeAIAnalyst,
} from './aiAnalystAtoms';
