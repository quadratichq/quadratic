import * as PIXI from 'pixi.js';
import { Viewport } from 'pixi-viewport';
import { alphaGridLines } from './gridUtils';
import { colors } from '../../../theme/colors';
import { CELL_HEIGHT, CELL_WIDTH } from '../../../constants/gridConstants';

export function gridLines(props: {
    viewport: Viewport;
    graphics: PIXI.Graphics;
}): void {
    const gridAlpha = alphaGridLines(props.viewport);
    const { viewport, graphics } = props;
    if (gridAlpha === false) {
        graphics.visible = false;
        return;
    }
    graphics.alpha = gridAlpha;
    graphics.visible = true;

    graphics.clear();

    // Configure Line Style
    graphics.lineStyle(1, colors.gridLines, 0.25, 0.5, true);

    const bounds = viewport.getVisibleBounds();
    const x_offset = bounds.left % CELL_WIDTH;
    const y_offset = bounds.top % CELL_HEIGHT;

    // Draw vertical lines
    for (let x = bounds.left; x <= bounds.right + CELL_WIDTH; x += CELL_WIDTH) {
        graphics.moveTo(x - x_offset, bounds.top);
        graphics.lineTo(x - x_offset, bounds.bottom);
    }

    // Draw horizontal lines
    for (let y = bounds.top; y <= bounds.bottom + CELL_HEIGHT; y += CELL_HEIGHT) {
        graphics.moveTo(bounds.left, y - y_offset);
        graphics.lineTo(bounds.right, y - y_offset);
    }
}