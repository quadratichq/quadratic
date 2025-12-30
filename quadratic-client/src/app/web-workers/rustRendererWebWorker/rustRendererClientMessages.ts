/**
 * Messages between the main thread (client) and the Rust Renderer web worker.
 *
 * These use JSON serialization since the client is TypeScript.
 */

import type { Rectangle } from 'pixi.js';

// ============================================================================
// Client → Rust Renderer Messages
// ============================================================================

/** Initialize the rust renderer with an OffscreenCanvas and core message port */
export interface ClientRustRendererInit {
  type: 'clientRustRendererInit';
  canvas: OffscreenCanvas;
  /** MessagePort for direct communication with core worker */
  corePort: MessagePort;
  devicePixelRatio: number;
}

/** Update the viewport (visible area and scale) */
export interface ClientRustRendererViewport {
  type: 'clientRustRendererViewport';
  sheetId: string;
  bounds: Rectangle;
  scale: number;
}

/** Switch to a different sheet */
export interface ClientRustRendererSetSheet {
  type: 'clientRustRendererSetSheet';
  sheetId: string;
}

/** Resize the canvas */
export interface ClientRustRendererResize {
  type: 'clientRustRendererResize';
  width: number;
  height: number;
  devicePixelRatio: number;
}

/** Request the renderer to take a screenshot (for thumbnails) */
export interface ClientRustRendererScreenshot {
  type: 'clientRustRendererScreenshot';
  id: number;
}

/** Ping message for testing communication */
export interface ClientRustRendererPing {
  type: 'clientRustRendererPing';
  timestamp: number;
}

/** Send the viewport SharedArrayBuffer for zero-copy viewport sync */
export interface ClientRustRendererViewportBuffer {
  type: 'clientRustRendererViewportBuffer';
  buffer: SharedArrayBuffer;
}

/** Send the FPS SharedArrayBuffer for zero-copy FPS sync */
export interface ClientRustRendererFPSBuffer {
  type: 'clientRustRendererFPSBuffer';
  buffer: SharedArrayBuffer;
}

export type ClientRustRendererMessage =
  | ClientRustRendererInit
  | ClientRustRendererViewport
  | ClientRustRendererSetSheet
  | ClientRustRendererResize
  | ClientRustRendererScreenshot
  | ClientRustRendererPing
  | ClientRustRendererViewportBuffer
  | ClientRustRendererFPSBuffer;

// ============================================================================
// Rust Renderer → Client Messages
// ============================================================================

/** Renderer is ready and initialized */
export interface RustRendererClientReady {
  type: 'rustRendererClientReady';
  backend: 'webgpu' | 'webgl';
}

/** Renderer encountered an error */
export interface RustRendererClientError {
  type: 'rustRendererClientError';
  error: string;
  fatal: boolean;
}

/** Screenshot response */
export interface RustRendererClientScreenshot {
  type: 'rustRendererClientScreenshot';
  id: number;
  imageData: Uint8Array;
  width: number;
  height: number;
}

/** Cell was clicked */
export interface RustRendererClientCellClick {
  type: 'rustRendererClientCellClick';
  sheetId: string;
  x: number;
  y: number;
  modifiers: {
    shift: boolean;
    ctrl: boolean;
    alt: boolean;
    meta: boolean;
  };
}

/** Cell is being hovered */
export interface RustRendererClientCellHover {
  type: 'rustRendererClientCellHover';
  sheetId: string;
  x: number | null;
  y: number | null;
}

/** User wants to edit a cell (double-click) */
export interface RustRendererClientCellEdit {
  type: 'rustRendererClientCellEdit';
  sheetId: string;
  x: number;
  y: number;
}

/** Selection changed in the renderer */
export interface RustRendererClientSelectionChanged {
  type: 'rustRendererClientSelectionChanged';
  sheetId: string;
  cursorX: number;
  cursorY: number;
  ranges: Array<{ minX: number; minY: number; maxX: number; maxY: number }>;
}

/** Pong response for testing communication */
export interface RustRendererClientPong {
  type: 'rustRendererClientPong';
  timestamp: number;
  roundTripMs: number;
}

/** Request meta fills (row/column/sheet fills) from core */
export interface RustRendererClientRequestMetaFills {
  type: 'rustRendererClientRequestMetaFills';
  sheetId: string;
}

export type RustRendererClientMessage =
  | RustRendererClientReady
  | RustRendererClientError
  | RustRendererClientScreenshot
  | RustRendererClientCellClick
  | RustRendererClientCellHover
  | RustRendererClientCellEdit
  | RustRendererClientSelectionChanged
  | RustRendererClientPong
  | RustRendererClientRequestMetaFills;
