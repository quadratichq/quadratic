import { pixiAppEvents } from '../../../gridGL/pixiApp/PixiAppEvents';
import { Coordinate } from '../../../gridGL/types/size';
import { Cell } from '../../../schemas';
import { SheetController } from '../sheetController';
import { Statement } from '../statement';

export const SetCellsRunner = (sheetController: SheetController, statement: Statement): Statement => {
  if (statement.type !== 'SET_CELLS') throw new Error('Incorrect statement type.');

  // Applies the SET_CELL statement to the sheet and returns the reverse statement
  const sheet = sheetController.sheet;
  const cellsToDelete: Coordinate[] = [];
  const cellsToUpdate: Cell[] = [];
  const changedCells: Coordinate[] = [];
  const old_values = statement.data.map((entry) => {
    changedCells.push({ x: entry.x, y: entry.y });
    if ((entry as any).type === undefined) {
      cellsToDelete.push(entry);
    } else {
      cellsToUpdate.push(entry as Cell);
    }
    const old_value = sheet.getCellCopy(entry.x, entry.y);
    if (!old_value) {
      return { x: entry.x, y: entry.y };
    }
    return old_value;
  });
  if (cellsToDelete.length) {
    sheet.grid.deleteCells(cellsToDelete, true);
  }
  if (cellsToUpdate.length) {
    sheet.grid.updateCells(cellsToUpdate, true);
  }
  sheet.recalculateBounds();
  pixiAppEvents.changeCells(sheetController.sheet, changedCells, { labels: true });

  // pixiAppEvents.quadrantsChanged({ cells: changedCells });
  return {
    type: 'SET_CELLS',
    data: old_values,
  };
};
