import { updateCellAndDCells } from './updateCellAndDCells';
import { PixiApp } from '../../gridGL/pixiApp/PixiApp';
import { SheetController } from '../controller/sheetController';

interface DeleteCellsArgs {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  sheetController: SheetController;
  pyodide?: any;
  app?: PixiApp;
  create_transaction?: boolean;
}

export const DeleteCells = async (args: DeleteCellsArgs) => {
  const { x0, y0, x1, y1, sheetController, pyodide, app, create_transaction } = args;

  if (create_transaction ?? true) sheetController.start_transaction();

  // cancel transaction if there are no cells to delete
  let deletingCells = false;

  // delete cells row by row
  for (var current_row = y0; current_row <= y1; current_row++) {
    const cells_to_delete = sheetController.sheet.grid.getNakedCells(x0, current_row, x1, current_row);

    // delete cells
    if (cells_to_delete.length !== 0) {
      deletingCells = true;
      await updateCellAndDCells({
        starting_cells: cells_to_delete,
        sheetController,
        pyodide,
        delete_starting_cells: true,
        app,
        create_transaction: false,
      });
    }
  }

  if (create_transaction ?? true) {
    if (!deletingCells) {
      sheetController.cancel_transaction();
    } else {
      sheetController.end_transaction();
    }
  }
};
