import { Sheet } from '../../sheet/Sheet';
import { Statement } from '../statement';
import { PixiApp } from '../../../gridGL/pixiApp/PixiApp';

export const SetCellRunner = (sheet: Sheet, statement: Statement, app?: PixiApp): Statement => {
  if (statement.type !== 'SET_CELL') throw new Error('Incorrect statement type.');
  // Applies the SET_CELL statement to the sheet and returns the reverse statement
  const { position, value: new_value } = statement.data;
  const old_value = sheet.getCellCopy(position[0], position[1]);
  const table = app?.table;

  if (new_value === undefined) {
    // if we are deleting a cell, we need to delete it from the grid
    // and return a statement that applies the old value.
    sheet.grid.deleteCells([{ x: position[0], y: position[1] }]);
    if (table) {
      table.quadrants.quadrantChanged({ cells: [{ x: position[0], y: position[1] }] });
      table.cells.dirty = true;
    }
    return {
      type: 'SET_CELL',
      data: {
        position,
        value: old_value,
      },
    } as Statement;
  } else {
    // if we are setting a cell, we need to update the grid
    // and return a statement that applies the old value.
    sheet.grid.updateCells([new_value]);
    if (table) {
      table.quadrants.quadrantChanged({ cells: [{ x: position[0], y: position[1] }] });
      table.cells.dirty = true;
    }
    return {
      type: 'SET_CELL',
      data: {
        position,
        value: old_value,
      },
    } as Statement;
  }
};
