import Globals from '../globals';

export function UpdateGridAlphaOnZoom(globals: Globals) {
  const viewport = globals.viewport;
  const grid_ui = globals.grid_ui;

  if (viewport.scale._x < 0.1) {
    grid_ui.visible = false;
  } else if (viewport.scale._x < 0.3) {
    grid_ui.alpha = viewport.scale._x * 3 - 0.3;
    grid_ui.visible = true;
  } else {
    grid_ui.alpha = 1;
  }
}
