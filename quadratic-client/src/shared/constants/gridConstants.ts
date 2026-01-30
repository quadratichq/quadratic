// Cell size constraints - imported from shared (must match quadratic-core/src/lib.rs)
export {
  MAX_CELL_HEIGHT,
  MAX_CELL_WIDTH,
  MIN_CELL_HEIGHT,
  MIN_CELL_WIDTH,
} from 'quadratic-shared/constants/gridConstants';

export const CELL_WIDTH = 100;
export const CELL_HEIGHT = 21;
export const CELL_TEXT_MARGIN_LEFT = 3;
export const CELL_TEXT_MARGIN_TOP = 1;
export const GRID_SIZE = 150;
export const ZOOM_ANIMATION_TIME_MS = 250;

// table column header sort button
export const SORT_BUTTON_RADIUS = 7;
export const SORT_BUTTON_PADDING = 3;

// default rendering font size (can't be 0)
export const DEFAULT_FONT_SIZE = 14;

// We use this to change how we display font size to the user. Internally, our
// default is 14 (this is historical based on initial rendering of the grid).
// But we want the default size to appear to the user as 10 (similar to Excel).
// So we adjust all font sizes by this amount in the UI.
export const FONT_SIZE_DISPLAY_ADJUSTMENT = -4;

// available font sizes for formatting (user-facing values)
export const FONT_SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 72, 96] as const;

// Internal min/max values (converted from user-facing values)
export const MIN_FONT_SIZE = 1 - FONT_SIZE_DISPLAY_ADJUSTMENT;
export const MAX_FONT_SIZE = 96 - FONT_SIZE_DISPLAY_ADJUSTMENT;
