import { updateCellAndDCells } from '../../actions/updateCellAndDCells';
import { SheetController } from '../../transaction/sheetController';

interface DeleteCellsArgs {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  sheetController: SheetController;
  pyodide?: any;
}

export const DeleteCells = async (args: DeleteCellsArgs) => {
  const { x0, y0, x1, y1, sheetController, pyodide } = args;

  const cells_to_delete = sheetController.sheet.grid.getNakedCells(x0, y0, x1, y1);

  // delete cells
  await updateCellAndDCells({ starting_cells: cells_to_delete, sheetController, pyodide, delete_starting_cells: true });
};
