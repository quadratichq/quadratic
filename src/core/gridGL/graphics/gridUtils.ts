import { Viewport } from 'pixi-viewport';

export function alphaGridLines(viewport?: Viewport): false | number {
    if (!viewport) return false;
    if (viewport.scale._x < 0.1) {
        return false;
    } else if (viewport.scale._x < 0.3) {
        return viewport.scale._x * 3 - 0.3;
    } else {
        return 1;
    }
}