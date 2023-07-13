import { Statement } from '../statement';
import { CellFormat } from '../../../schemas';
import { SheetController } from '../sheetController';

const CopyCellFormat = (format: CellFormat | undefined): CellFormat | undefined => {
  if (format === undefined) return undefined;
  return { ...format, textFormat: format.textFormat !== undefined ? { ...format.textFormat } : undefined }; // deep copy the textFormat
};

export const SetCellFormatRunner = (sheetController: SheetController, statement: Statement): Statement => {
  if (statement.type !== 'SET_CELL_FORMAT') throw new Error('Incorrect statement type.');
  // Applies the SET_CELL_FORMAT statement to the sheet and returns the reverse statement
  const { position, value: new_value } = statement.data;
  const sheet = sheetController.sheet;
  const old_value = CopyCellFormat(sheet.grid.getFormat(position[0], position[1]));

  // if we are clearing formatting
  if (new_value === undefined) {
    // Clear the cell format
    if (old_value !== undefined) sheet.grid.clearFormat([old_value]);
    window.dispatchEvent(
      new CustomEvent('quadrants-changed', { detail: { cells: [{ x: position[0], y: position[1] }] } })
    );
    window.dispatchEvent(new CustomEvent('set-dirty', { detail: { cells: true } }));
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
    sheet.grid.updateFormat([{ ...new_value, x: position[0], y: position[1] }]);
    window.dispatchEvent(
      new CustomEvent('quadrants-changed', { detail: { cells: [{ x: position[0], y: position[1] }] } })
    );
    window.dispatchEvent(new CustomEvent('set-dirty', { detail: { cells: true } }));
    return {
      type: 'SET_CELL_FORMAT',
      data: {
        position,
        value: old_value,
      },
    } as Statement;
  }
};
