import { Rectangle } from 'pixi.js';
import { PixiApp } from '../../../pixiApp/PixiApp';
import { Coordinate } from '../../../types/size';
import { findAutoComplete } from './findAutoComplete';
import { updateCellAndDCells } from '../../../../grid/actions/updateCellAndDCells';
import { Border, Cell, CellFormat } from '../../../../schemas';
import { DeleteCells } from '../../../../grid/actions/DeleteCells';
import { SheetController } from '../../../../grid/controller/sheetController';

export const shrinkHorizontal = async (options: {
  app: PixiApp;
  selection: Rectangle;
  endCell: Coordinate;
}): Promise<void> => {
  const { app, selection, endCell } = options;
  const { sheet_controller } = app;
  await DeleteCells({
    x0: endCell.x + 1,
    y0: selection.top,
    x1: selection.right,
    y1: selection.bottom,
    sheetController: sheet_controller,
    create_transaction: false,
  });
};

export const shrinkVertical = async (options: {
  app: PixiApp;
  selection: Rectangle;
  endCell: Coordinate;
}): Promise<void> => {
  const { app, selection, endCell } = options;
  const { sheet_controller } = app;

  await DeleteCells({
    x0: selection.left,
    y0: endCell.y + 1,
    x1: selection.right,
    y1: selection.bottom,
    sheetController: sheet_controller,
    create_transaction: false,
  });
};

const updateFormatAndBorders = async (options: {
  cells: Cell[];
  sheet_controller: SheetController;
  formats: CellFormat[];
  borders: Border[];
}) => {
  const { cells, sheet_controller, formats, borders } = options;
  await updateCellAndDCells({
    create_transaction: false,
    starting_cells: cells,
    sheetController: sheet_controller,
  });
  formats.forEach((format) => {
    sheet_controller.execute_statement({
      type: 'SET_CELL_FORMAT',
      data: {
        position: [format.x, format.y],
        value: format,
      },
    });
  });
  borders.forEach((border) => {
    sheet_controller.execute_statement({
      type: 'SET_BORDER',
      data: {
        position: [border.x, border.y],
        border,
      },
    });
  });
};

export const expandDown = async (options: {
  app: PixiApp;
  selection: Rectangle;
  to: number;
  shrinkHorizontal?: number;
}): Promise<void> => {
  const { app, selection, to, shrinkHorizontal } = options;
  const { sheet_controller, sheet } = app;

  const cells: Cell[] = [];
  const formats: CellFormat[] = [];
  const borders: Border[] = [];
  const right = shrinkHorizontal === undefined ? selection.right : shrinkHorizontal;
  for (let x = selection.left; x <= right; x++) {
    const rectangle = sheet.grid.getCells(new Rectangle(x, selection.top, 0, selection.bottom - selection.top));
    rectangle.addBorders(sheet.borders, true);
    const series: (Cell | undefined)[] = [];
    for (let y = selection.top; y <= selection.bottom; y++) {
      series.push(rectangle.get(x, y)?.cell);
    }
    const results = findAutoComplete({ series, spaces: to - selection.bottom, negative: false });
    results.forEach((value, index) => {
      const yIndex = selection.bottom + index + 1;
      if (value === undefined) {
        cells.push({
          type: 'TEXT',
          value: '',
          x,
          y: yIndex,
        });
      } else {
        cells.push({
          ...(value as Cell),
          x,
          y: yIndex,
        });
      }
    });
    let index = 0;

    // formats & borders
    for (let y = selection.bottom + 1; y <= to; y++) {
      const format = rectangle.get(x, selection.top + index)?.format;
      if (format) {
        formats.push({ ...format, x, y });
      } else {
        formats.push({ x, y });
      }

      const border = rectangle.getBorder(x, selection.top + index);
      if (border) {
        borders.push({ ...border, x, y });
      } else {
        borders.push({ x, y });
      }

      // change border on right edge
      if (x === right) {
        const border = rectangle.getBorder(x + 1, selection.top + index);
        const existing = app.sheet.borders.get(x + 1, y);
        borders.push({ vertical: border?.vertical, x: x + 1, y, horizontal: existing?.horizontal });
      }

      // change border on bottom edge
      if (y === to) {
        const border = rectangle.getBorder(x, selection.top + index + 1);
        const existing = app.sheet.borders.get(x, y + 1);
        borders.push({ vertical: existing?.vertical, x, y: y + 1, horizontal: border?.horizontal });
      }

      index = (index + 1) % (selection.bottom - selection.top + 1);
    }
  }
  await updateFormatAndBorders({
    cells,
    sheet_controller,
    formats,
    borders,
  });
};

export const expandUp = async (options: {
  app: PixiApp;
  selection: Rectangle;
  to: number;
  shrinkHorizontal?: number;
}): Promise<void> => {
  const { app, selection, to, shrinkHorizontal } = options;
  const { sheet_controller, sheet } = app;

  const cells: Cell[] = [];
  const formats: CellFormat[] = [];
  const borders: Border[] = [];
  const right = shrinkHorizontal === undefined ? selection.right : shrinkHorizontal;
  for (let x = selection.left; x <= right; x++) {
    const rectangle = sheet.grid.getCells(new Rectangle(x, selection.top, 0, selection.bottom - selection.top));
    rectangle.addBorders(sheet.borders, true);
    const series: (Cell | undefined)[] = [];
    for (let y = selection.top; y <= selection.bottom; y++) {
      series.push(rectangle.get(x, y)?.cell);
    }
    const results = findAutoComplete({ series, spaces: selection.top - to, negative: true });
    results.forEach((value, index) => {
      const yIndex = to + index;
      if (!value) {
        cells.push({
          type: 'TEXT',
          value: '',
          x,
          y: yIndex,
        });
      } else {
        cells.push({
          ...value,
          x,
          y: yIndex,
        });
      }
    });
    let index = 0;

    // format
    for (let y = to; y < selection.top; y++) {
      const format = rectangle.get(x, selection.top + index)?.format;
      if (format) {
        formats.push({ ...format, x, y });
      } else {
        formats.push({ x, y });
      }
      index = (index + 1) % (selection.bottom - selection.top + 1);
    }

    // borders
    index = selection.height;
    for (let y = selection.top - 1; y >= to; y--) {
      const border = rectangle.getBorder(x, selection.top + index);
      if (border) {
        borders.push({ ...border, x, y });
      } else {
        borders.push({ x, y });
      }

      // change border on right edge
      if (x === right) {
        const border = rectangle.getBorder(x + 1, selection.top + index);
        const existing = app.sheet.borders.get(x + 1, y);
        borders.push({ vertical: border?.vertical, x: x + 1, y, horizontal: existing?.horizontal });
      }
      index--;
      if (index === -1) index = selection.height;
    }
  }
  await updateFormatAndBorders({
    cells,
    sheet_controller,
    formats,
    borders,
  });
};

export const expandRight = async (options: {
  app: PixiApp;
  selection: Rectangle;
  to: number;
  toVertical?: number;
}): Promise<void> => {
  const { app, selection, to, toVertical } = options;
  const { sheet_controller, sheet } = app;
  const cells: Cell[] = [];
  const formats: CellFormat[] = [];
  const borders: Border[] = [];
  const top = toVertical === undefined ? selection.top : Math.min(selection.top, toVertical);
  const bottom = toVertical === undefined ? selection.bottom : Math.max(selection.bottom, toVertical);
  for (let y = top; y <= bottom; y++) {
    const rectangle = sheet.grid.getCells(new Rectangle(selection.left, y, selection.right - selection.left, 0));
    rectangle.addBorders(sheet.borders, true);
    const series: (Cell | undefined)[] = [];
    for (let x = selection.left; x <= selection.right; x++) {
      series.push(rectangle.get(x, y)?.cell);
    }
    const results = findAutoComplete({ series, spaces: to - selection.right, negative: false });
    results.forEach((value, index) => {
      const xIndex = selection.right + index + 1;
      if (value === undefined) {
        cells.push({
          value: '',
          type: 'TEXT',
          x: xIndex,
          y,
        });
      } else {
        cells.push({
          ...(value as Cell),
          x: xIndex,
          y,
        });
      }
    });
    let index = 0;

    // formats & borders
    for (let x = selection.right + 1; x <= to; x++) {
      const format = rectangle.get(selection.left + index, y)?.format;
      if (format) {
        formats.push({ ...format, x, y });
      } else {
        formats.push({ x, y });
      }

      const border = rectangle.getBorder(selection.left + index, y);
      if (border) {
        borders.push({ ...border, x, y });
      } else {
        borders.push({ x, y });
      }

      // change border on right edge
      if (x === to) {
        const border = rectangle.getBorder(selection.left + index + 1, y);
        const existing = app.sheet.borders.get(x + 1, y);
        borders.push({ vertical: border?.vertical, x: x + 1, y, horizontal: existing?.horizontal });
      }

      // change border on bottom edge
      if (y === bottom) {
        const border = rectangle.getBorder(selection.left + index, y + 1);
        const existing = app.sheet.borders.get(x, y + 1);
        borders.push({ vertical: existing?.vertical, x, y: y + 1, horizontal: border?.horizontal });
      }

      index = (index + 1) % (selection.right - selection.left + 1);
    }
  }
  await updateFormatAndBorders({
    cells,
    sheet_controller,
    formats,
    borders,
  });
};

export const expandLeft = async (options: {
  app: PixiApp;
  selection: Rectangle;
  to: number;
  toVertical?: number;
}): Promise<void> => {
  const { app, selection, to, toVertical } = options;
  const { sheet_controller, sheet } = app;

  const cells: Cell[] = [];
  const formats: CellFormat[] = [];
  const borders: Border[] = [];
  const top = toVertical === undefined ? selection.top : Math.min(selection.top, toVertical);
  const bottom = toVertical === undefined ? selection.bottom : Math.max(selection.bottom, toVertical);
  for (let y = top; y <= bottom; y++) {
    const rectangle = sheet.grid.getCells(new Rectangle(selection.left, y, selection.right - selection.left, 0));
    rectangle.addBorders(sheet.borders, true);
    const series: (Cell | undefined)[] = [];
    for (let x = selection.left; x <= selection.right; x++) {
      series.push(rectangle.get(x, y)?.cell);
    }
    const results = findAutoComplete({ series, spaces: selection.left - to, negative: true });
    results.forEach((value, index) => {
      if (!value) {
        cells.push({
          value: '',
          x: to + index,
          y,
          type: 'TEXT',
        });
      } else {
        cells.push({
          ...value,
          x: to + index,
          y,
        });
      }
    });

    // formats
    let index = 0;
    for (let x = to; x < selection.left; x++) {
      const format = rectangle.get(selection.left + index, y)?.format;
      if (format) {
        formats.push({ ...format, x, y });
      } else {
        formats.push({ x, y });
      }
      index = (index + 1) % (selection.width + 1);
    }

    // borders
    index = selection.width;
    for (let x = selection.left - 1; x >= to; x--) {
      const border = rectangle.getBorder(selection.left + index, y);
      if (border) {
        borders.push({ ...border, x, y });
      } else {
        borders.push({ x, y });
      }

      // change border on bottom edge
      if (y === bottom) {
        const border = rectangle.getBorder(selection.left + index, y + 1);
        const existing = app.sheet.borders.get(x, y + 1);
        borders.push({ vertical: existing?.vertical, x, y: y + 1, horizontal: border?.horizontal });
      }

      index--;
      if (index === -1) index = selection.width;
    }
  }
  await updateFormatAndBorders({
    cells,
    sheet_controller,
    formats,
    borders,
  });
};
