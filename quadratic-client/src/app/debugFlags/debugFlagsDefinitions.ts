//! Definitions and display settings for all debug flags. These are accessible
//! in the app via the Cmd+Option+Shift+I (Ctrl+Alt+Shift+I in windows) menu.

export const debugFlagGroups = ['Rendering', 'Transactions', 'Times', 'Misc.', 'UI', 'WebWorkers', 'AI', 'Playwright'];

export type DebugFlagGroup = (typeof debugFlagGroups)[number];

export interface DebugFlagDescription {
  initial: boolean;
  title: string;
  description?: string;
  group?: DebugFlagGroup;
  restart?: boolean;
}

export type DebugFlagKeys =
  | 'debug'
  | 'debugShowFPS'
  | 'debugShowWhyRendering'
  | 'debugShowTime'
  | 'debugShowCellsSheetCulling'
  | 'debugShowCellsHashBoxes'
  | 'debugShowHashUpdates'
  | 'debugShowCellHashesInfo'
  | 'debugShowLoadingHashes'
  | 'debugShowRunComputation'
  | 'debugShowOfflineTransactions'
  | 'debugStartupTime'
  | 'debugShowFileIO'
  | 'debugShowAnalytics'
  | 'debugOffline'
  | 'debugGridSettings'
  | 'debugShowMultiplayer'
  | 'debugShowVersionCheck'
  | 'debugShowUILogs'
  | 'debugShowFocus'
  | 'debugWebWorkers'
  | 'debugWebWorkersMessages'
  | 'debugShowAIModelMenu'
  | 'debugShowAIInternalContext'
  | 'debugLogJsonAIInternalContext'
  | 'debugLogReadableAIInternalContext'
  | 'debugAIAnalystChatStringInput'
  | 'debugAIAnalystChatEditing'
  | 'debugShowTopLeftPosition'
  | 'debugShowCoordinates'
  | 'debugShowAPITimes';

export const debugFlagDescriptions: Record<DebugFlagKeys, DebugFlagDescription> = {
  debug: {
    initial: false,
    title: 'Debug Flag',
    description: 'Master override for all debug flags.',
  },

  debugShowFPS: {
    initial: false,
    title: 'Show FPS in the bottom bar',
    description: 'Shows FPS meter & renderer light in bottom bar',
    group: 'Rendering',
  },
  debugShowWhyRendering: {
    initial: false,
    title: 'Show cause of rendering',
    description: 'Shows why rendering is happening. This is useful for debugging rendering issues.',
    group: 'Rendering',
  },
  debugShowCellsSheetCulling: {
    initial: false,
    title: 'Show CellsSheet culling',
    description: 'Reports on CellsSheet culling',
    group: 'Rendering',
  },
  debugShowCellsHashBoxes: {
    initial: false,
    title: 'Draws CellsHash boxes',
    description: 'Draws colored boxes around each CellsHash',
    group: 'Rendering',
    restart: false,
  },
  debugShowCellHashesInfo: {
    initial: false,
    title: 'Show CellsHash information',
    description: 'Show CellsHash information',
    group: 'Rendering',
  },
  debugShowLoadingHashes: {
    initial: false,
    title: 'Show loading hashes',
    description: 'Show loading hashes',
    group: 'Rendering',
  },
  debugShowHashUpdates: {
    initial: false,
    title: 'Show hash updates',
    description: 'Show hash updates in console',
    group: 'Rendering',
  },

  debugShowRunComputation: {
    initial: false,
    title: 'Show TS Run Computation',
    description: 'Show results of runComputation() in console (for TS related computations)',
    group: 'Transactions',
  },
  debugShowOfflineTransactions: {
    initial: false,
    title: 'Show Offline Transactions',
    description: 'Show output from offline transactions in console',
    group: 'Transactions',
  },

  // Times group
  debugStartupTime: {
    initial: false,
    title: 'Show Startup Time',
    description: 'Show startup time information',
    group: 'Times',
  },
  debugShowTime: {
    initial: true,
    title: 'Show rendering time',
    description: 'Shows unexpectedly high rendering time in console',
    group: 'Times',
  },
  debugShowAPITimes: {
    initial: false,
    title: 'Show API Times',
    description: 'Show API times in console',
    group: 'Times',
  },

  // Misc. group
  debugShowFileIO: {
    initial: false,
    title: 'Show File I/O',
    description: 'Show file input/output operations',
    group: 'Misc.',
  },
  debugShowAnalytics: {
    initial: false,
    title: 'Show Analytics',
    description: 'Show analytics information',
    group: 'Misc.',
  },
  debugOffline: {
    initial: false,
    title: 'Show Offline Messages',
    description: 'Show messages related to offline transactions',
    group: 'Misc.',
  },
  debugGridSettings: {
    initial: false,
    title: 'Show Grid Settings',
    description: 'Show grid settings information',
    group: 'Misc.',
  },
  debugShowMultiplayer: {
    initial: false,
    title: 'Show Multiplayer',
    description: 'Show multiplayer related information',
    group: 'Misc.',
  },
  debugShowVersionCheck: {
    initial: true,
    title: 'Show Version Check',
    description: 'Show version check information',
    group: 'Misc.',
  },
  // UI group
  debugShowUILogs: {
    initial: false,
    title: 'Show UI Logs',
    description: 'Show UI related logs',
    group: 'UI',
  },
  debugShowFocus: {
    initial: false,
    title: 'Show Focus',
    description: 'Show the focus in the console whenever it changes',
    group: 'UI',
  },

  // WebWorkers group
  debugWebWorkers: {
    initial: false,
    title: 'Show Web Workers',
    description: "Show web workers' information",
    group: 'WebWorkers',
  },
  debugWebWorkersMessages: {
    initial: false,
    title: 'Show Web Workers Messages',
    description: "Show web workers' messages",
    group: 'WebWorkers',
  },

  // AI group
  debugShowAIModelMenu: {
    initial: false,
    title: 'Show AI Model Menu',
    description: 'Shows the AI model menu in the AI chat. Otherwise, it shows what a normal user will see.',
    group: 'AI',
  },
  debugShowAIInternalContext: {
    initial: false,
    title: 'Show AI Internal Context',
    description: 'Shows the internal context in AI chat',
    group: 'AI',
  },
  debugLogJsonAIInternalContext: {
    initial: false,
    title: 'Log JSON AI Internal Context',
    description: 'Logs the AI Context to the console in JSON format',
    group: 'AI',
  },
  debugLogReadableAIInternalContext: {
    initial: false,
    title: 'Log readable AI Internal Context',
    description: 'Logs the AI Context to the console in a readable form',
    group: 'AI',
  },
  debugAIAnalystChatStringInput: {
    initial: false,
    title: 'AI Analyst Chat String Input',
    description: 'Enable input box with json string representation of the chat',
    group: 'AI',
  },
  debugAIAnalystChatEditing: {
    initial: false,
    title: 'AI Analyst Chat Editing',
    description: 'Change chat to edit mode. This allows you to edit the chat in real time.',
    group: 'AI',
  },

  debugShowTopLeftPosition: {
    initial: false,
    title: 'Show Top Left position in footer',
    group: 'Playwright',
  },
  debugShowCoordinates: {
    initial: false,
    title: 'Show viewport coordinates in the bottom bar',
    description: 'Use coordinates to create E2E tests',
    group: 'Playwright',
  },
};

export type DebugFlag = keyof typeof debugFlagDescriptions;

export type DebugFlagOptions = {
  [K in DebugFlag]: boolean;
};

export const debugFlagDefaults: DebugFlagOptions = Object.entries(debugFlagDescriptions).reduce<DebugFlagOptions>(
  (acc, [key, value]) => ({
    ...acc,
    [key]: value.initial,
  }),
  {} as DebugFlagOptions
);
