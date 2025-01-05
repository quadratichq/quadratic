import type { Rect } from '@/app/quadratic-core-types';
import {
  newAllSelection,
  newRectSelection,
  newSingleSelection,
} from '@/app/quadratic-rust-client/quadratic_rust_client';

export const getSingleSelection = (sheetId: string, x: number, y: number): string => {
  try {
    return newSingleSelection(sheetId, x, y).save();
  } catch (e) {
    console.error('Failed to get single selection', e);
    throw new Error(`Failed to get single selection`);
  }
};

export const getRectSelection = (sheetId: string, rect: Rect): string => {
  try {
    return newRectSelection(sheetId, rect.min.x, rect.min.y, rect.max.x, rect.max.y);
  } catch (e) {
    console.error('Failed to get rect selection', e);
    throw new Error(`Failed to get rect selection`);
  }
};

export const getAllSelection = (sheetId: string): string => {
  try {
    return newAllSelection(sheetId);
  } catch (e) {
    console.error('Failed to get all selections', e);
    throw new Error(`Failed to get all selections`);
  }
};
