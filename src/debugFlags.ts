// set this in .env (if set to false then all debug flags are turned off)
export const debug = process.env.REACT_APP_DEBUG === "1" ? true : false;

// shows renderer light
export const debugShowRenderer = debug && true;

// shows FPS meter
export const debugShowFPS = debug && true;

// shows rendering time for components
export const debugShowTime = debug && false;

// counts number of children and which are visible in the viewport
export const debugShowCountRenderedObjects = debug && false;
