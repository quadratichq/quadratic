export const focusGrid = () => {
  // Set focus back to Grid
  const grid = document.querySelector('.pixi_canvas') as HTMLCanvasElement;
  if (grid) {
    grid.focus();
  } else {
    console.error('`focusGrid()` tried to set the focus back to the grid, but couldn’t find it.');
  }
};
