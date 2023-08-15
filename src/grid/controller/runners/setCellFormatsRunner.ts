import { pixiAppEvents } from '../../../gridGL/pixiApp/PixiAppEvents';
import { Coordinate } from '../../../gridGL/types/size';
import { CellFormat } from '../../../schemas';
import { SheetController } from '../SheetController';
import { Statement } from '../statement';

const CopyCellFormat = (format: CellFormat | undefined): CellFormat | undefined => {
  if (format === undefined) return undefined;
  return { ...format, textFormat: format.textFormat !== undefined ? { ...format.textFormat } : undefined }; // deep copy the textFormat
};

export const SetCellFormatsRunner = (sheetController: SheetController, statement: Statement): Statement => {
  if (statement.type !== 'SET_CELL_FORMATS') throw new Error('Incorrect statement type.');
  // Applies the SET_CELL_FORMAT statement to the sheet and returns the reverse statement
  const sheet = sheetController.sheet;
  const cells: Coordinate[] = [];
  const old_values = statement.data.map((format) => {
    cells.push({ x: format.x, y: format.y });
    const old_value = CopyCellFormat(sheet.grid.getFormat(format.x, format.y));
    if (!old_value) {
      return { x: format.x, y: format.y };
    } else {
      return old_value;
    }
  });
  sheet.grid.updateFormat(statement.data);
  pixiAppEvents.quadrantsChanged({ cells });
  return {
    type: 'SET_CELL_FORMATS',
    data: old_values,
  } as Statement;
};
