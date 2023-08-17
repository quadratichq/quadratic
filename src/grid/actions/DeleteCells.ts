import { SheetController } from '../controller/SheetController';

interface DeleteCellsArgs {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  sheetController: SheetController;
  create_transaction?: boolean;
}

export const DeleteCells = async (args: DeleteCellsArgs) => {
  throw new Error('replaced');
  // const { x0, y0, x1, y1, sheetController, create_transaction } = args;

  // if (create_transaction ?? true) sheetController.start_transaction();

  // // cancel transaction if there are no cells to delete
  // let deletingCells = false;

  // // delete cells row by row
  // for (var current_row = y0; current_row <= y1; current_row++) {
  //   const cells_to_delete = sheetController.sheet.grid.getNakedCells(x0, current_row, x1, current_row);

  //   // delete cells
  //   if (cells_to_delete.length !== 0) {
  //     deletingCells = true;
  //     await updateCellAndDCells({
  //       starting_cells: cells_to_delete,
  //       sheetController,
  //       delete_starting_cells: true,
  //       create_transaction: false,
  //     });
  //   }
  // }

  // if (create_transaction ?? true) {
  //   if (!deletingCells) {
  //     sheetController.cancel_transaction();
  //   } else {
  //     sheetController.end_transaction();
  //   }
  // }
};
