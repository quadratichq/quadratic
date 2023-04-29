/* eslint-disable @typescript-eslint/no-unused-vars */
import { Rectangle } from 'pixi.js';
import { PixiApp } from '../../../pixiApp/PixiApp';
import { Coordinate } from '../../../types/size';
import { findAutoComplete } from './findAutoComplete';
import { updateCellAndDCells } from '../../../../grid/actions/updateCellAndDCells';
import { Cell } from '../../../../schemas';
import { DeleteCells } from '../../../../grid/actions/DeleteCells';

export const shrinkHorizontal = async (options: {
  app: PixiApp;
  selection: Rectangle;
  endCell: Coordinate;
}): Promise<void> => {
  const { app, selection, endCell } = options;
  const { sheet_controller } = app;
  await DeleteCells({
    x0: endCell.x,
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

export const expandDown = async (options: { app: PixiApp; selection: Rectangle; to: number }): Promise<void> => {
  const { app, selection, to } = options;
  const { sheet_controller, sheet } = app;

  const cells: Cell[] = [];
  for (let x = selection.left; x <= selection.right; x++) {
    const rectangle = sheet.grid.getCells(new Rectangle(x, selection.top, x, selection.bottom));
    const series: (Cell | undefined)[] = [];
    for (let y = selection.top; y <= selection.bottom; y++) {
      series.push(rectangle.get(x, y)?.cell);
    }
    const results = findAutoComplete({ series, spaces: to - selection.bottom, negative: false });
    const updatedCells: Cell[] = results.flatMap((value, index) => {
      if (value === undefined) {
        return [];
      } else {
        return {
          ...(value as Cell),
          x,
          y: selection.bottom + index + 1,
        };
      }
    });
    cells.push(...updatedCells);
  }
  await updateCellAndDCells({
    create_transaction: false,
    starting_cells: cells,
    sheetController: sheet_controller,
  });
};

export const expandUp = async (options: { app: PixiApp; selection: Rectangle; to: number }): Promise<void> => {
  const { app, selection, to } = options;
  const { sheet_controller, sheet } = app;

  const cells: Cell[] = [];
  for (let x = selection.left; x <= selection.right; x++) {
    const rectangle = sheet.grid.getCells(new Rectangle(x, selection.top, x, selection.bottom));
    const series: (Cell | undefined)[] = [];
    for (let y = selection.top; y <= selection.bottom; y++) {
      series.push(rectangle.get(x, y)?.cell);
    }
    const results = findAutoComplete({ series, spaces: selection.top - to, negative: true });
    const updatedCells: Cell[] = results.map((value, index) => ({
      ...(value as Cell),
      x,
      y: to + index,
    }));
    cells.push(...updatedCells);
  }
  await updateCellAndDCells({
    create_transaction: false,
    starting_cells: cells,
    sheetController: sheet_controller,
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
  const top = toVertical === undefined ? selection.top : Math.min(selection.top, toVertical);
  const bottom = toVertical === undefined ? selection.bottom : Math.max(selection.bottom, toVertical);
  for (let y = top; y <= bottom; y++) {
    const rectangle = sheet.grid.getCells(new Rectangle(selection.left, y, selection.right, y));
    const series: (Cell | undefined)[] = [];
    for (let x = selection.left; x <= selection.right; x++) {
      series.push(rectangle.get(x, y)?.cell);
    }
    const results = findAutoComplete({ series, spaces: to - selection.right, negative: false });
    const updatedCells: Cell[] = results.flatMap((value, index) => {
      if (value === undefined) {
        return [];
      } else {
        return {
          ...(value as Cell),
          x: selection.right + index + 1,
          y,
        };
      }
    });
    cells.push(...updatedCells);
  }
  await updateCellAndDCells({
    create_transaction: false,
    starting_cells: cells,
    sheetController: sheet_controller,
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
  const top = toVertical === undefined ? selection.top : Math.min(selection.top, toVertical);
  const bottom = toVertical === undefined ? selection.bottom : Math.max(selection.bottom, toVertical);
  for (let y = top; y <= bottom; y++) {
    const rectangle = sheet.grid.getCells(new Rectangle(selection.left, y, selection.right, y));
    const series: (Cell | undefined)[] = [];
    for (let x = selection.left; x <= selection.right; x++) {
      series.push(rectangle.get(x, y)?.cell);
    }
    const results = findAutoComplete({ series, spaces: selection.left - to, negative: true });
    const updatedCells: Cell[] = results.flatMap((value, index) => {
      if (!value) return [];
      return [
        {
          ...value,
          x: to + index,
          y,
        },
      ];
    });
    cells.push(...updatedCells);
  }
  await updateCellAndDCells({
    create_transaction: false,
    starting_cells: cells,
    sheetController: sheet_controller,
  });
};
