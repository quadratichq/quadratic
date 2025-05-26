//! Definitions and display settings for all debug flags. These are accessible
//! in the app via the Cmd+Option+Shift+I (Ctrl+Alt+Shift+I in windows) menu.

export const debugFlagGroups = ['Rendering', 'Transactions', 'Misc.', 'UI', 'WebWorkers', 'AI'];

export type DebugFlagGroup = (typeof debugFlagGroups)[number];

export interface DebugFlagDescription {
  initial: boolean;
  title: string;
  description?: string;
  group?: DebugFlagGroup;
  restart?: boolean;
}

export const debugFlagDescriptions: Record<string, DebugFlagDescription> = {
  debug: {
    initial: false,
    title: 'Debug Flag',
    description:
      'Master override for all debug flags. This is on in development. In production, debug is not available unless you add `?debug` to the url.',
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
  debugShowTime: {
    initial: true,
    title: 'Show rendering time',
    description: 'Shows unexpectedly high rendering time in console',
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
    restart: true,
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

  // Misc. group
  debugStartupTime: {
    initial: false,
    title: 'Show Startup Time',
    description: 'Show startup time information',
    group: 'Misc.',
  },
  debugShowFileIO: {
    initial: false,
    title: 'Show File I/O',
    description: 'Show file input/output operations',
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
  debugSaveURLState: {
    initial: false,
    title: 'Save URL State',
    description: 'Save URL state information',
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
    description: 'Show web workers information',
    group: 'WebWorkers',
  },
  debugWebWorkersMessages: {
    initial: false,
    title: 'Show Web Workers Messages',
    description: 'Show web workers messages',
    group: 'WebWorkers',
  },

  // AI group
  debugShowAIInternalContext: {
    initial: false,
    title: 'Show AI Internal Context',
    description: 'Shows the internal context in AI chat',
    group: 'AI',
  },
  debugPrintAIInternalContext: {
    initial: false,
    title: 'Print readable AI Context',
    description: 'Prints the AI Context to the console in a readable form',
    group: 'AI',
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
