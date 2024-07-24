// CAUTION: This file is necessary!
// If this folder has no typescript files it in it will cause the server to break at runtime.
// This is because tsc will build `dist/server.js` instead of `dist/src/server.js` silently which will break the server at runtime!
// Because of this we have to ensure there is at least a single typescript file in this folder.

export const PLACEHOLDER = 'PLACEHOLDER';
