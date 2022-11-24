import { CELL_HEIGHT, CELL_WIDTH } from '../../../constants/gridConstants';

export const QUADRANT_SCALE = 0.5;
export const QUADRANT_TEXTURE_SIZE = 2048;

// maximum number of columns and rows of default size that fits in the texture
export const QUADRANT_COLUMNS = Math.floor(QUADRANT_TEXTURE_SIZE / CELL_WIDTH) - 1;
export const QUADRANT_ROWS = Math.floor(QUADRANT_TEXTURE_SIZE / CELL_HEIGHT) - 1;