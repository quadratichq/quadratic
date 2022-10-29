// set this in .env (if set to false then all debug flags are turned off)
export const debug = process.env.REACT_APP_DEBUG ?? false;

// shows renderer light
export const debugShowRenderer = true;

// shows FPS meter
export const debugShowFPS = true;

// shows rendering time for components
export const debugShowTime = false;

// counts number of children and which are visible in the viewport
export const debugShowCountRenderedObjects = false;