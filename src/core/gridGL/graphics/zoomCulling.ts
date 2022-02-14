import Globals from "../globals";

export function ZoomCulling(globals: Globals) {
  const viewport = globals.viewport;
  const grid_ui = globals.grid_ui;

  if (viewport.scale._x < 0.1) {
    // for (const row in grid.data) {
    //   for (const col in grid.data[row]) {
    //     const cell = grid.data[row][col];
    //     if (cell && cell.bitmap_text) {
    //       cell.bitmap_text.visible = false;
    //     }
    //   }
    grid_ui.visible = false;
  } else if (viewport.scale._x < 0.3) {
    // for (const row in grid.data) {
    //   for (const col in grid.data[row]) {
    //     const cell = grid.data[row][col];
    //     if (cell && cell.bitmap_text) {
    //       cell.bitmap_text.visible = true;
    //       cell.bitmap_text.alpha = viewport.scale._x * 3 - 0.3;
    //     }
    //   }
    // }
    grid_ui.alpha = viewport.scale._x * 3 - 0.3;
    grid_ui.visible = true;
  } else {
    // for (const row in grid.data) {
    //   for (const col in grid.data[row]) {
    //     const cell = grid.data[row][col];
    //     if (cell && cell.bitmap_text) {
    //       cell.bitmap_text.visible = true;
    //       cell.bitmap_text.alpha = 1;
    //     }
    //   }
    // }
    grid_ui.alpha = 1;
  }
}
