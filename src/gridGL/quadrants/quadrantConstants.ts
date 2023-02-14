import { CELL_HEIGHT, CELL_WIDTH } from '../../constants/gridConstants';

export const QUADRANT_SCALE = 0.75;
export const QUADRANT_TEXTURE_SIZE = 2048;

// maximum number of columns and rows of default size that fits in the texture
export const QUADRANT_COLUMNS = Math.floor(QUADRANT_TEXTURE_SIZE / CELL_WIDTH);
export const QUADRANT_ROWS = Math.floor(QUADRANT_TEXTURE_SIZE / CELL_HEIGHT);

// number of ms to wait after a user interaction before rendering more quadrants
export const QUADRANT_RENDER_WAIT = 200;
