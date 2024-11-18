import { newSingleSelection } from '@/app/quadratic-rust-client/quadratic_rust_client';

export const getSingleSelection = (sheetId: string, x: number, y: number): string => {
  try {
    const selection = newSingleSelection(sheetId, x, y);
    return selection.save();
  } catch (e) {
    throw new Error('Failed to get single selection');
  }
};
