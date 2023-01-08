import { Sheet } from '../../gridDB/Sheet';
import { Statement } from '../statement';
import { CellFormat } from '../../gridDB/gridTypes';
import { PixiApp } from '../../gridGL/pixiApp/PixiApp';
import { localFiles } from '../../gridDB/localFiles';

const CopyCellFormat = (format: CellFormat | undefined): CellFormat | undefined => {
  if (format === undefined) return undefined;
  return {
    x: format.x,
    y: format.y,
    fillColor: format.fillColor,
  };
};

export const SetCellFormatRunner = (sheet: Sheet, statement: Statement, app?: PixiApp): Statement => {
  if (statement.type !== 'SET_CELL_FORMAT') throw new Error('Incorrect statement type.');
  // Applies the SET_CELL statement to the sheet and returns the reverse statement
  const { position, value: new_value } = statement.data;
  const old_value = CopyCellFormat(sheet.grid.getFormat(position[0], position[1]));

  // if we are clearing formatting
  if (new_value === undefined) {
    // Clear the cell format
    if (old_value !== undefined) sheet.grid.clearFormat([old_value]);
    if (app) {
      app.quadrants.quadrantChanged({ cells: [{ x: position[0], y: position[1] }] });
      app.cells.dirty = true;
      localFiles.saveLastLocal(sheet.export_file());
    }
    return {
      type: 'SET_CELL_FORMAT',
      data: {
        position,
        value: old_value,
      },
    } as Statement;
  } else {
    // if we are setting formatting we update the grid
    // and return a statement that applies the old value.
    sheet.grid.updateFormat([new_value]);
    if (app) {
      app.quadrants.quadrantChanged({ cells: [{ x: position[0], y: position[1] }] });
      app.cells.dirty = true;
      localFiles.saveLastLocal(sheet.export_file());
    }
    return {
      type: 'SET_CELL_FORMAT',
      data: {
        position,
        value: old_value,
      },
    } as Statement;
  }
};
