const url = new URLSearchParams(typeof window === 'undefined' ? '' : window.location.search);

// set this in .env (if set to false then all debug flags are turned off)
export const debug = url.has('debug') || import.meta.env.VITE_DEBUG === '1' ? true : false;

// ------------------
// Debug footer marks
// ------------------

export const debugShow = debug && false;

// shows FPS meter & renderer light
export const debugShowFPS = (debug && true) || url.has('fps');

// ------------
// Transactions
// ------------

// show results of runComputation() in console (for TS related computations)
export const debugShowRunComputation = debug && false;

export const debugShowOfflineTransactions = debug && false;

// ----------
// Rendering
// ----------

// shows rendering time
export const debugShowTime = debug && true;

// counts number of children and which are visible in the viewport
export const debugShowCountRenderedObjects = debug && false;

// shows count of cached sprites for formatting
export const debugShowCachedSpriteCounts = debug && false;

// shows why renderer is rendering
export const debugShowWhyRendering = debug && false;

// shows CellsSheet culling
export const debugShowCellsSheetCulling = debug && false;

// shows CellsHash boxes
export const debugShowCellsHashBoxes = (debug && false) || url.has('boxes');

// shows CellsHash information
export const debugShowCellHashesInfo = debug && false;

// reports on rendering
export const debugShowHashUpdates = debug && false;

// reports on loading/unloading hashes
export const debugShowLoadingHashes = debug && false;

// --------
// Misc.
// --------

export const debugShowFileIO = debug && false;

// shows messages related to offline transaction
export const debugOffline = debug && false;

export const debugGridSettings = debug && false;

export const debugShowMultiplayer = debug && false;

export const debugSaveURLState = debug && false;

// --------
// UI
// --------

export const debugShowUILogs = debug && false;

//-----------
// WebWorkers
//-----------

export const debugWebWorkers = debug && false;

export const debugWebWorkersMessages = debug && false;

// -----------
// AI
// -----------

export const debugShowAIInternalContext = debug && false;
