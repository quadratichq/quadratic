/**
 * Viewport module - camera/view management
 *
 * Equivalent to the viewport/ folder in gridGL/pixiApp/ and the Rust viewport module.
 *
 * This module provides viewport management that runs on the main thread and syncs
 * to the Rust renderer via SharedArrayBuffer.
 */

export { Viewport, SNAP_BACK_DELAY, SNAP_BACK_MAX_DISTANCE, SNAP_BACK_VELOCITY } from './Viewport';
export type { VisibleBounds } from './Viewport';

export { Decelerate, DEFAULT_DECELERATE_OPTIONS } from './Decelerate';
export type { DecelerateOptions } from './Decelerate';

export {
  createViewportBuffer,
  readViewportBuffer,
  writeViewportBuffer,
  markViewportClean,
  markViewportDirty,
  isViewportDirty,
  VIEWPORT_BUFFER_SIZE,
  ViewportBufferIndex,
} from './ViewportBuffer';
export type { ViewportState } from './ViewportBuffer';

export {
  ViewportControls,
  calculateZoomFactor,
  clientToCanvasPixels,
  WHEEL_ZOOM_PERCENT,
  LINE_HEIGHT,
  WHEEL_ZOOM_DIVISOR,
  PINCH_ZOOM_DIVISOR,
  VIEWPORT_UPDATE_DEBOUNCE,
} from './ViewportControls';
export type {
  ViewportMessage,
  MessageSender,
  ViewportChangeCallback,
  ViewportControlsOptions,
} from './ViewportControls';
