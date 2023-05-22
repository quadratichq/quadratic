import { Rectangle } from 'pixi.js';
import { PixiApp } from '../../../pixiApp/PixiApp';
import { Coordinate } from '../../../types/size';
import { findAutoComplete } from './findAutoComplete';
import { updateCellAndDCells } from '../../../../grid/actions/updateCellAndDCells';
import { Cell, CellFormat } from '../../../../schemas';
import { DeleteCells } from '../../../../grid/actions/DeleteCells';

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
    app: sheet_controller.app,
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
    app: sheet_controller.app,
    create_transaction: false,
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
  const right = shrinkHorizontal === undefined ? selection.right : shrinkHorizontal;
  for (let x = selection.left; x <= right; x++) {
    const rectangle = sheet.grid.getCells(new Rectangle(x, selection.top, x, selection.bottom));
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
    for (let y = selection.bottom + 1; y <= to; y++) {
      const format = rectangle.get(x, selection.top + index)?.format;
      if (format) {
        formats.push({ ...format, x, y });
      } else {
        formats.push({ x, y });
      }
      index = (index + 1) % (selection.bottom - selection.top + 1);
    }
  }
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
  const right = shrinkHorizontal === undefined ? selection.right : shrinkHorizontal;
  for (let x = selection.left; x <= right; x++) {
    const rectangle = sheet.grid.getCells(new Rectangle(x, selection.top, x, selection.bottom));
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
    for (let y = to; y < selection.top; y++) {
      const format = rectangle.get(x, selection.top + index)?.format;
      if (format) {
        formats.push({ ...format, x, y });
      } else {
        formats.push({ x, y });
      }
      index = (index + 1) % (selection.bottom - selection.top + 1);
    }
  }

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
  const top = toVertical === undefined ? selection.top : Math.min(selection.top, toVertical);
  const bottom = toVertical === undefined ? selection.bottom : Math.max(selection.bottom, toVertical);
  for (let y = top; y <= bottom; y++) {
    const rectangle = sheet.grid.getCells(new Rectangle(selection.left, y, selection.right, y));
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
    for (let x = selection.right + 1; x <= to; x++) {
      const format = rectangle.get(selection.left + index, y)?.format;
      if (format) {
        formats.push({ ...format, x, y });
      } else {
        formats.push({ x, y });
      }
      index = (index + 1) % (selection.right - selection.left + 1);
    }
  }
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
  const top = toVertical === undefined ? selection.top : Math.min(selection.top, toVertical);
  const bottom = toVertical === undefined ? selection.bottom : Math.max(selection.bottom, toVertical);
  for (let y = top; y <= bottom; y++) {
    const rectangle = sheet.grid.getCells(new Rectangle(selection.left, y, selection.right, y));
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
    let index = 0;
    for (let x = to; x < selection.left; x++) {
      const format = rectangle.get(selection.left + index, y)?.format;
      if (format) {
        formats.push({ ...format, x, y });
      } else {
        formats.push({ x, y });
      }
      index = (index + 1) % (selection.right - selection.left + 1);
    }
  }
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
};
