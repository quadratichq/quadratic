import { Viewport } from 'pixi-viewport';

// calculates the fade alpha for grid when zooming out
export function calculateAlphaForGridLines(viewport?: Viewport): number {
  if (!viewport) return 0;
  if (viewport.scale._x < 0.1) {
    return 0;
  } else if (viewport.scale._x < 0.4) {
    return viewport.scale._x * 3 - 0.4;
  } else {
    return 1;
  }
}
