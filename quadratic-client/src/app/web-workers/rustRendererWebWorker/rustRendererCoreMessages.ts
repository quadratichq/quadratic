/**
 * Messages between Core web worker and Rust Renderer web worker.
 *
 * These use bincode serialization for efficiency (Rust-to-Rust).
 * The actual message types are defined in quadratic-core-shared.
 *
 * This file documents the wire format and provides helpers for the
 * TypeScript side to understand what's being transferred.
 */

// ============================================================================
// Wire Format
// ============================================================================
//
// Messages between Core and Rust Renderer are binary (bincode encoded).
// They are transferred as Uint8Array via MessagePort.postMessage with
// the ArrayBuffer as a Transferable for zero-copy transfer.
//
// The Rust types are defined in: quadratic-core-shared/src/messages.rs
//
// Core → Renderer:
//   - InitSheet: Initial cell data for a sheet
//   - HashCells: Updated cell data for specific hash buckets
//   - DirtyHashes: Notification that hashes need re-rendering
//   - Selection: Current selection state
//   - MultiplayerCursors: Other users' cursors
//   - SheetInfo: Sheet metadata (name, color, order)
//   - SheetOffsets: Column/row sizes
//   - SheetDeleted: Sheet was removed
//   - ClearSheet: Request to clear cache
//
// Renderer → Core:
//   - ViewportChanged: Visible area changed, request cell data
//   - CellClick: User clicked a cell
//   - CellHover: User is hovering over a cell
//   - SelectionStart/Drag/End: User is selecting cells
//   - CellEdit: User wants to edit a cell
//   - ColumnResize/RowResize: User is resizing
//   - Ready: Renderer is initialized

// ============================================================================
// Message Type Discriminants
// ============================================================================
//
// These match the bincode-serialized enum discriminants from Rust.
// They're useful for debugging/logging but shouldn't be used for
// deserialization (that happens in Rust).

export const CoreToRendererType = {
  InitSheet: 0,
  HashCells: 1,
  DirtyHashes: 2,
  Selection: 3,
  MultiplayerCursors: 4,
  SheetInfo: 5,
  SheetOffsets: 6,
  SheetDeleted: 7,
  ClearSheet: 8,
} as const;

export const RendererToCoreType = {
  ViewportChanged: 0,
  CellClick: 1,
  CellHover: 2,
  SelectionStart: 3,
  SelectionDrag: 4,
  SelectionEnd: 5,
  CellEdit: 6,
  ColumnResize: 7,
  RowResize: 8,
  Ready: 9,
} as const;

// ============================================================================
// Helper Types for TypeScript
// ============================================================================

/** Binary message from Core to Renderer (bincode encoded) */
export interface CoreRustRendererBinaryMessage {
  type: 'coreRustRendererBinary';
  data: Uint8Array;
}

/** Binary message from Renderer to Core (bincode encoded) */
export interface RustRendererCoreBinaryMessage {
  type: 'rustRendererCoreBinary';
  data: Uint8Array;
}

// ============================================================================
// Debug Helpers
// ============================================================================

/**
 * Get a human-readable name for a Core→Renderer message type.
 * Only reads the first byte (enum discriminant) for logging.
 */
export function getCoreToRendererTypeName(data: Uint8Array): string {
  if (data.length === 0) return 'Empty';
  const discriminant = data[0];
  const entry = Object.entries(CoreToRendererType).find(([_, v]) => v === discriminant);
  return entry ? entry[0] : `Unknown(${discriminant})`;
}

/**
 * Get a human-readable name for a Renderer→Core message type.
 * Only reads the first byte (enum discriminant) for logging.
 */
export function getRendererToCoreTypeName(data: Uint8Array): string {
  if (data.length === 0) return 'Empty';
  const discriminant = data[0];
  const entry = Object.entries(RendererToCoreType).find(([_, v]) => v === discriminant);
  return entry ? entry[0] : `Unknown(${discriminant})`;
}
