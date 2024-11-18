import { Matrix, Renderer } from 'pixi.js';
import { sheets } from '../../grid/controller/Sheets';
import { pixiApp } from './PixiApp';

const resolution = 4;
const borderSize = 1;
const maxTextureSize = 4096;

let renderer: Renderer | undefined;

/** returns a dataURL to a copy of the selected cells */
export const copyAsPNG = async (): Promise<Blob | null> => {
  if (!renderer) {
    renderer = new Renderer({
      resolution,
      antialias: true,
      backgroundColor: 0xffffff,
    });
  }

  // todo...add a function in quadraticCore that does this.
  // let column, width, row, height;
  // const sheet = sheets.sheet;
  // const cursor = sheet.cursor;

  // if (cursor.multiCursor) {
  //   const selection = cursor.getLargestMultiCursorRectangle();
  //   column = selection.left;
  //   row = selection.top;
  //   width = selection.width;
  //   height = selection.height;
  // } else if (cursor.columnRow) {
  //   if (cursor.columnRow.all) {
  //     const bounds = sheet.getBounds(false);
  //     if (bounds) {
  //       column = bounds.left;
  //       row = bounds.top;
  //       width = bounds.width + 1;
  //       height = bounds.height + 1;
  //     }
  //   } else if (cursor.columnRow.columns?.length) {
  //     const columns = cursor.columnRow.columns.sort((a, b) => a - b);
  //     const bounds = await quadraticCore.getColumnsBounds(sheet.id, columns[0], columns[columns.length - 1]);
  //     column = columns[0];
  //     width = columns[columns.length - 1] - columns[0] + 1;
  //     row = bounds?.min ?? 0;
  //     height = bounds ? bounds.max - bounds.min + 1 : 1;
  //   } else if (cursor.columnRow.rows?.length) {
  //     const rows = cursor.columnRow.rows.sort((a, b) => a - b);
  //     const bounds = await quadraticCore.getRowsBounds(sheet.id, rows[0], rows[rows.length - 1]);
  //     row = rows[0];
  //     height = rows[rows.length - 1] - rows[0] + 1;
  //     column = bounds?.min ?? 0;
  //     width = bounds ? bounds.max - bounds.min + 1 : 1;
  //   }
  // } else {
  //   column = cursor.position.x;
  //   row = cursor.position.y;
  //   width = height = 0;
  // }
  // if (column === undefined || row === undefined || width === undefined || height === undefined) {
  //   column = 0;
  //   row = 0;
  //   width = 1;
  //   height = 1;
  // }

  const column = 1;
  const row = 1;
  const width = 1;
  const height = 1;
  const rectangle = sheets.sheet.getScreenRectangle(column, row, width - 1, height - 1);

  // captures bottom-right border size
  rectangle.width += borderSize * 2;
  rectangle.height += borderSize * 2;

  let imageWidth = rectangle.width * resolution,
    imageHeight = rectangle.height * resolution;
  if (Math.max(imageWidth, imageHeight) > maxTextureSize) {
    if (imageWidth > imageHeight) {
      imageHeight = imageHeight * (maxTextureSize / imageWidth);
      imageWidth = maxTextureSize;
    } else {
      imageWidth = imageWidth * (maxTextureSize / imageHeight);
      imageHeight = maxTextureSize;
    }
  }
  renderer.resize(imageWidth, imageHeight);
  renderer.view.width = imageWidth;
  renderer.view.height = imageHeight;
  pixiApp.prepareForCopying();

  // todo
  // app.cells.drawCells(app.sheet, rectangle, false);
  const transform = new Matrix();
  transform.translate(-rectangle.x + borderSize / 2, -rectangle.y + borderSize / 2);
  const scale = imageWidth / (rectangle.width * resolution);
  transform.scale(scale, scale);
  renderer.render(pixiApp.viewportContents, { transform });
  pixiApp.cleanUpAfterCopying();
  return new Promise((resolve) => {
    renderer!.view.toBlob((blob) => resolve(blob));
  });
};
