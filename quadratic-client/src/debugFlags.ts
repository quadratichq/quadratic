const url = new URLSearchParams(typeof window === 'undefined' ? '' : window.location.search);

// set this in .env (if set to false then all debug flags are turned off)
export const debug = url.has('debug') || import.meta.env.VITE_DEBUG === '1' ? true : false;

// ------------------
// Debug footer marks
// ------------------

// shows FPS meter & renderer light
export const debugShowFPS = (debug && true) || url.has('fps');

// add a CACHE render count to the footer
export const debugShowCacheCount = debug && true;

// add a CACHE flag to the footer to indicate when cache is visible instead of cells
export const debugShowCacheFlag = debug && true;

// ------------
// Transactions
// ------------

// show results of runComputation() in console (for TS related computations)
export const debugShowRunComputation = debug && false;

// ----------
// Rendering
// ----------

// shows rendering time
export const debugShowTime = debug && true;

// show rust time
export const debugShowRustTime = debug && false;

// counts number of children and which are visible in the viewport
export const debugShowCountRenderedObjects = debug && false;

// shows count of cached sprites for formatting
export const debugShowCachedSpriteCounts = debug && false;

// shows why renderer is rendering
export const debugShowWhyRendering = debug && false;

// shows CellsSheet culling
export const debugShowCellsSheetCulling = debug && false;

// shows CellsHash boxes
export const debugShowCellsHashBoxes = (debug && false) || url.has('cell-boxes');

// shows CellsHash information
export const debugShowCellHashesInfo = debug && false;

// --------
// Misc.
// --------

export const debugShowFileIO = debug && false;

export const debugGridSettings = debug && false;

export const debugShowMultiplayer = debug && true;

export const debugDisableProxy = debug && false;

// --------
// UI
// --------

export const debugShowUILogs = debug && false;
