import { Graphics } from 'pixi.js';
import { Viewport } from 'pixi-viewport';

export const drawAxisLines = (viewport: Viewport, grid: Graphics, showGridAxes: boolean): void => {
    grid.clear();

    const bounds = viewport.getVisibleBounds();

    if (showGridAxes) {
        grid.lineStyle(10, 0x000000, 0.35, 0, true);
        if (0 >= bounds.left && 0 <= bounds.right) {
            grid.moveTo(0, bounds.top);
            grid.lineTo(0, bounds.bottom);
        }
        if (0 >= bounds.top && 0 <= bounds.bottom) {
            grid.moveTo(bounds.left, 0);
            grid.lineTo(bounds.right, 0);
        }
    }
};
