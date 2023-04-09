import { Rectangle } from 'pixi.js';
import { PixiApp } from '../../../pixiApp/PixiApp';
import { Coordinate } from '../../../types/size';
import { DeleteCells } from '../../../../grid/actions/DeleteCells';
import { findAutoComplete } from './findAutoComplete';
import { updateCellAndDCells } from '../../../../grid/actions/updateCellAndDCells';
import { Cell } from '../../../../schemas';

export const shrinkHorizontal = async (options: {
  app: PixiApp;
  selection: Rectangle;
  endCell: Coordinate;
}): Promise<void> => {
  const { app, selection, endCell } = options;
  const { sheet_controller } = app;
  sheet_controller.start_transaction();
  await DeleteCells({
    x0: endCell.x,
    y0: selection.top,
    x1: selection.right,
    y1: selection.bottom,
    sheetController: sheet_controller,
    app: sheet_controller.app,
    create_transaction: false,
  });
  sheet_controller.end_transaction();

  const { setInteractionState, interactionState } = app.settings;
  setInteractionState?.({
    ...interactionState,
    multiCursorPosition: {
      originPosition: interactionState.multiCursorPosition.originPosition,
      terminalPosition: {
        ...interactionState.multiCursorPosition.terminalPosition,
        x: endCell.x - 1,
      },
    },
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
    create_transaction: true,
  });

  const { setInteractionState, interactionState } = app.settings;
  setInteractionState?.({
    ...interactionState,
    multiCursorPosition: {
      originPosition: interactionState.multiCursorPosition.originPosition,
      terminalPosition: {
        ...interactionState.multiCursorPosition.terminalPosition,
        y: endCell.y,
      },
    },
  });
};

export const expandDown = async (options: {
  app: PixiApp;
  selection: Rectangle;
  boxCells: Rectangle;
}): Promise<void> => {
  const { app, selection, boxCells } = options;
  const { sheet_controller, sheet } = app;

  const cells: Cell[] = [];
  for (let x = selection.left; x <= selection.right; x++) {
    const rectangle = sheet.grid.getCells(new Rectangle(x, selection.top, x, selection.bottom));
    const series: (Cell | undefined)[] = [];
    for (let y = selection.top; y <= selection.bottom; y++) {
      series.push(rectangle.get(x, y)?.cell);
    }
    const results = findAutoComplete({ series, spaces: boxCells.bottom - selection.bottom - 1, negative: false });
    const updatedCells: Cell[] = results.map((value, index) => ({
      ...(value as Cell),
      x,
      y: selection.bottom + index + 1,
    }));
    cells.push(...updatedCells);
  }
  await updateCellAndDCells({
    create_transaction: true,
    starting_cells: cells,
    sheetController: sheet_controller,
  });

  const { setInteractionState, interactionState } = app.settings;
  setInteractionState?.({
    ...interactionState,
    multiCursorPosition: {
      originPosition: interactionState.multiCursorPosition.originPosition,
      terminalPosition: {
        ...interactionState.multiCursorPosition.terminalPosition,
        y: boxCells.bottom - 1,
      },
    },
  });
};

export const expandUp = async (options: { app: PixiApp; selection: Rectangle; boxCells: Rectangle }): Promise<void> => {
  const { app, selection, boxCells } = options;
  const { sheet_controller, sheet } = app;

  const cells: Cell[] = [];
  for (let x = selection.left; x <= selection.right; x++) {
    const rectangle = sheet.grid.getCells(new Rectangle(x, selection.top, x, selection.bottom));
    const series: (Cell | undefined)[] = [];
    for (let y = selection.top; y <= selection.bottom; y++) {
      series.push(rectangle.get(x, y)?.cell);
    }
    const results = findAutoComplete({ series, spaces: selection.top - boxCells.top, negative: true });
    const updatedCells: Cell[] = results.map((value, index) => ({
      ...(value as Cell),
      x,
      y: boxCells.top + index,
    }));
    cells.push(...updatedCells);
  }
  await updateCellAndDCells({
    create_transaction: true,
    starting_cells: cells,
    sheetController: sheet_controller,
  });

  const { setInteractionState, interactionState } = app.settings;
  setInteractionState?.({
    ...interactionState,
    multiCursorPosition: {
      originPosition: {
        ...interactionState.multiCursorPosition.originPosition,
        y: boxCells.top,
      },
      terminalPosition: interactionState.multiCursorPosition.terminalPosition,
    },
  });
};

export const expandRight = async (options: {
  app: PixiApp;
  selection: Rectangle;
  boxCells: Rectangle;
}): Promise<void> => {
  const { app, selection, boxCells } = options;
  const { sheet_controller, sheet } = app;

  const cells: Cell[] = [];
  for (let y = selection.top; y <= selection.bottom; y++) {
    const rectangle = sheet.grid.getCells(new Rectangle(selection.left, y, selection.right, y));
    const series: (Cell | undefined)[] = [];
    for (let x = selection.left; x <= selection.right; x++) {
      series.push(rectangle.get(x, y)?.cell);
    }
    const results = findAutoComplete({ series, spaces: boxCells.right - selection.right - 1, negative: false });
    const updatedCells: Cell[] = results.map((value, index) => ({
      ...(value as Cell),
      x: selection.right + index + 1,
      y,
    }));
    cells.push(...updatedCells);
  }
  await updateCellAndDCells({
    create_transaction: true,
    starting_cells: cells,
    sheetController: sheet_controller,
  });

  const { setInteractionState, interactionState } = app.settings;
  setInteractionState?.({
    ...interactionState,
    multiCursorPosition: {
      originPosition: interactionState.multiCursorPosition.originPosition,
      terminalPosition: {
        ...interactionState.multiCursorPosition.terminalPosition,
        x: boxCells.right - 1,
      },
    },
  });
};

export const expandLeft = async (options: {
  app: PixiApp;
  selection: Rectangle;
  boxCells: Rectangle;
}): Promise<void> => {
  const { app, selection, boxCells } = options;
  const { sheet_controller, sheet } = app;

  const cells: Cell[] = [];
  for (let y = selection.top; y <= selection.bottom; y++) {
    const rectangle = sheet.grid.getCells(new Rectangle(selection.left, y, selection.right, y));
    const series: (Cell | undefined)[] = [];
    for (let x = selection.left; x <= selection.right; x++) {
      series.push(rectangle.get(x, y)?.cell);
    }
    const results = findAutoComplete({ series, spaces: selection.left - boxCells.left, negative: true });
    const updatedCells: Cell[] = results.flatMap((value, index) => {
      if (!value) return [];
      return [
        {
          ...value,
          x: boxCells.left + index,
          y,
        },
      ];
    });
    cells.push(...updatedCells);
  }
  await updateCellAndDCells({
    create_transaction: true,
    starting_cells: cells,
    sheetController: sheet_controller,
  });

  const { setInteractionState, interactionState } = app.settings;
  setInteractionState?.({
    ...interactionState,
    multiCursorPosition: {
      originPosition: {
        ...interactionState.multiCursorPosition.originPosition,
        x: boxCells.left,
      },
      terminalPosition: interactionState.multiCursorPosition.terminalPosition,
    },
  });
};
