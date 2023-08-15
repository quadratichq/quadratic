import { pixiAppEvents } from '../../../gridGL/pixiApp/PixiAppEvents';
import { SheetController } from '../_sheetController';
import { Statement } from '../statement';

export const SetHeadingSizeRunner = (sheetController: SheetController, statement: Statement): Statement => {
  if (statement.type !== 'SET_HEADING_SIZE') throw new Error('Incorrect statement type.');
  // Applies the SET_HEADING_SIZE statement to the sheet and returns the reverse statement
  const sheet = sheetController.sheet;

  const { heading_size } = statement.data;

  // create reverse statement
  let reverse_heading_size = { ...heading_size };
  if (heading_size.column !== undefined)
    reverse_heading_size.size = sheet.gridOffsets.getCommittedColumnWidth(heading_size.column);
  else if (heading_size.row !== undefined)
    reverse_heading_size.size = sheet.gridOffsets.getCommittedRowHeight(heading_size.row);
  else throw new Error('Heading size must be set for a column or a row.');

  // set heading size
  sheet.gridOffsets.update(heading_size);

  // mark things as dirty
  // TODO: move to end_transaction
  pixiAppEvents.setDirty({ gridLines: true, cursor: true, headings: true });
  if (heading_size.column !== undefined) {
    pixiAppEvents.quadrantsChanged({ column: heading_size.column });
  } else if (heading_size.row !== undefined) {
    pixiAppEvents.quadrantsChanged({ row: heading_size.row });
  }

  // return reverse statement
  return {
    type: 'SET_HEADING_SIZE',
    data: {
      heading_size: reverse_heading_size,
    },
  };
};
