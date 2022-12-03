// set this in .env (if set to false then all debug flags are turned off)
export const debug = process.env.REACT_APP_DEBUG === '1' ? true : false;

// skip python load (used to speed up debugging)
export const debugSkipPythonLoad = debug && true;

// ------------------
// Debug footer marks
// ------------------

// shows renderer light
export const debugShowRenderer = debug && true;

// shows FPS meter
export const debugShowFPS = debug && true;

// -------------------------
// Rendering time and counts
// -------------------------

// shows rendering time
export const debugShowTime = debug && false;

// counts number of children and which are visible in the viewport
export const debugShowCountRenderedObjects = debug && false;

// shows count of cached sprites for formatting
export const debugShowCachedSpriteCounts = debug && false;

// ----------------
// Quadrant caching
// ----------------

// add a CACHE flag to the footer to indicate when cache is visible instead of cells
export const debugShowCacheFlag = debug && true;

// add a CACHE render count to the footer
export const debugShowCacheCount = debug && true;

// shows information about quadrant generation
export const debugShowCacheInfo = debug && false;

// shows information about subquadrant generation
export const debugShowSubCacheInfo = debug && false;

// always show cache instead of cell rendering
export const debugAlwaysShowCache = debug && false;

// always show cells instead of cache rendering
export const debugNeverShowCache = debug && false;

// don't render quadrants
export const debugSkipQuadrantRendering = debug && false;

// show quadrant colored boxes around rendered range
export const debugShowQuadrantBoxes = debug && false;

export function warn(...args: any): void {
  if (debug) {
    console.warn(...args);
  }
}
