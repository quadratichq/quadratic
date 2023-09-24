const url = new URLSearchParams(window.location.search);

// set this in .env (if set to false then all debug flags are turned off)
export const debug = url.has('debug') || process.env.REACT_APP_DEBUG === '1' ? true : false;

// ------------------
// Debug footer marks
// ------------------

// shows FPS meter & renderer light
export const debugShowFPS = (debug && true) || url.has('fps');

// add a CACHE render count to the footer
export const debugShowCacheCount = debug && true;

// add a CACHE flag to the footer to indicate when cache is visible instead of cells
export const debugShowCacheFlag = debug && true;

// -------------
// Feature Flags
// -------------

export const debugMockLargeData = (debug && false) || url.has('mock-large-data');

// ------------
// Transactions
// ------------

// show number of transactions
export const debugShowTransactions = debug && false;

// show results of runComputation() in console
export const debugShowRunComputation = debug && false;

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
export const debugShowCellsHashBoxes = debug && false;

// shows CellsHash information
export const debugShowCellHashesInfo = debug && false;

// ----------------
// Quadrant caching
// ----------------

// shows information about subquadrant generation
export const debugShowSubCacheInfo = debug && false;

// always show cache instead of cell rendering
export const debugAlwaysShowCache = debug && false;

// shows information about quadrant generation
export const debugShowCacheInfo = debug && false;

// always show cells instead of cache rendering
export const debugNeverShowCache = debug && false;

// don't render quadrants
export const debugSkipQuadrantRendering = debug && false;

// show quadrant colored boxes around rendered range
export const debugShowQuadrantBoxes = debug && false;

// only render getCellsForDirtyQuadrants -- useful for testing the direct draw of multiple dirty quadrants
export const debugShowCellsForDirtyQuadrants = debug && false;

// --------
// Misc.
// --------

export const debugShowFileIO = debug && true;

export const debugGridSettings = debug && false;

// --------
// UI
// --------

export const debugShowUILogs = debug && false;
