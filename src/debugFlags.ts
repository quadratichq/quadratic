// set this in .env (if set to false then all debug flags are turned off)
export const debug = process.env.REACT_APP_DEBUG === '1' ? true : false;

export const debugShowRenderer = debug && true;                 // shows renderer light
export const debugShowFPS = debug && true;                      // shows FPS meter

export const debugSkipPythonLoad = debug && true;               // skip python load (used to speed up debugging)

// rendering time and counts
export const debugShowTime = debug && true;                     // shows rendering time for components
export const debugShowCountRenderedObjects = debug && false;    // counts number of children and which are visible in the viewport
export const debugShowCachedSpriteCounts = debug && false;      // shows count of cached sprites for formatting

// quadrant Caching
export const debugShowCacheFlag = debug && true;                // add a CACHE flag to the footer to indicate when cache is visible instead of cells
export const debugShowCacheInfo = debug && true;                // shows information about quadrant generation
export const debugShowSubCacheInfo = debug && false;            // shows information about subquadrant generation
export const debugAlwaysShowCache = debug && false;             // always show cache instead of cell rendering
export const debugNeverShowCache = debug && false;               // always show cells instead of cache rendering

export function warn(...args: any): void {
  if (debug) {
    console.warn(...args);
  }
}
