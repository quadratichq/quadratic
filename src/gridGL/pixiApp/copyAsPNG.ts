import { Renderer } from 'pixi.js';
import { PixiApp } from './PixiApp';

const resolution = 2;

const renderer = new Renderer({
  resolution,
  antialias: true,
  backgroundColor: 0xffffff,
});

/** returns a dataURL to a copy of the selected cells */
export const copyAsPNG = (app: PixiApp): string => {
  let column, width, row, height;
  const interaction = app.settings.interactionState;
  if (interaction.showMultiCursor) {
    const { originPosition, terminalPosition } = interaction.multiCursorPosition;
    column = originPosition.x;
    row = originPosition.y;
    width = terminalPosition.x - row;
    height = terminalPosition.y - column;
  } else {
    column = interaction.cursorPosition.x;
    row = interaction.cursorPosition.y;
    width = height = 1;
  }
  const rectangle = app.sheet.gridOffsets.getScreenRectangle(column, row, width, height);
  renderer.resize(rectangle.width * resolution, rectangle.height * resolution);
  renderer.view.width = rectangle.width * resolution;
  renderer.view.height = rectangle.height * resolution
  app.prepareForQuadrantRendering();
  app.cells.drawCells(rectangle, false);
  renderer.render(app.stage);
  app.cleanUpAfterQuadrantRendering();
  return renderer.view.toDataURL("image/png");
};