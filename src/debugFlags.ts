// set this in .env (if set to false then all debug flags are turned off)
export const debug = process.env.REACT_APP_DEBUG === '1' ? true : false;

// shows renderer light
export const debugShowRenderer = debug && true;

// shows FPS meter
export const debugShowFPS = debug && true;

// shows rendering time for components
export const debugShowTime = debug && true;

// counts number of children and which are visible in the viewport
export const debugShowCountRenderedObjects = debug && false;

// shows count of cached sprites for formatting
export const debugShowCachedSpriteCounts = debug && false;

// skip python load (used to speed up debugging)
export const debugSkipPythonLoad = debug && true;

// add a CACHE flag to the footer to indicate when cache is visible instead of cells
export const debugShowCacheFlag = debug && true;

// shows information about quadrant generation
export const debugShowCacheInfo = debug && true;

// shows information about subquadrant generation
export const debugShowSubCacheInfo = debug && false;

// always show cache instead of cell rendering
export const debugAlwaysShowCache = debug && false;

export function warn(...args: any): void {
  if (debug) {
    console.warn(...args);
  }
}
