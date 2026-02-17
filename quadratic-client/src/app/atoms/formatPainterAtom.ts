//! Jotai atom for format painter state management.
//!
//! The format painter allows users to copy formatting from one selection
//! and apply it to another selection.

import { atom, getDefaultStore } from 'jotai';

export interface FormatPainterState {
  active: boolean;
  // Serialized A1Selection of the source (the cells whose format will be copied)
  sourceSelection?: string;
  // Sheet ID of the source selection
  sourceSheetId?: string;
}

const defaultFormatPainterState: FormatPainterState = {
  active: false,
  sourceSelection: undefined,
  sourceSheetId: undefined,
};

export const formatPainterAtom = atom<FormatPainterState>(defaultFormatPainterState);

/**
 * Activates format painter mode with the given source selection.
 */
export const activateFormatPainter = (sourceSelection: string, sourceSheetId: string) => {
  getDefaultStore().set(formatPainterAtom, {
    active: true,
    sourceSelection,
    sourceSheetId,
  });
};

/**
 * Deactivates format painter mode (cancels without applying).
 */
export const deactivateFormatPainter = () => {
  getDefaultStore().set(formatPainterAtom, defaultFormatPainterState);
};

/**
 * Gets the current format painter state.
 */
export const getFormatPainterState = (): FormatPainterState => {
  return getDefaultStore().get(formatPainterAtom);
};

/**
 * Returns whether format painter is currently active.
 */
export const isFormatPainterActive = (): boolean => {
  return getDefaultStore().get(formatPainterAtom).active;
};
