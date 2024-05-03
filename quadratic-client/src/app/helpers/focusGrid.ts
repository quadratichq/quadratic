export const focusGrid = () => {
  // Set focus back to Grid
  const grid = document.querySelector('.pixi_canvas') as HTMLCanvasElement;
  if (grid) {
    grid.focus();
  }
};
