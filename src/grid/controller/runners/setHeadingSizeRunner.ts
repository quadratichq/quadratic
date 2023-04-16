import { Sheet } from '../../sheet/Sheet';
import { PixiApp } from '../../../gridGL/pixiApp/PixiApp';
import { Statement } from '../statement';

export const SetHeadingSizeRunner = (sheet: Sheet, statement: Statement, app?: PixiApp): Statement => {
  if (statement.type !== 'SET_HEADING_SIZE') throw new Error('Incorrect statement type.');
  // Applies the SET_HEADING_SIZE statement to the sheet and returns the reverse statement

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

  const table = app?.table;

  // mark things as dirty
  // TODO: move to end_transaction
  if (table) {
    table.cells.dirty = true;
    table.gridLines.dirty = true;
    app.cursor.dirty = true;
    app.headings.dirty = true;
    if (heading_size.column !== undefined) table.quadrants.quadrantChanged({ column: heading_size.column });
    else if (heading_size.row !== undefined) table.quadrants.quadrantChanged({ row: heading_size.row });
  }

  // return reverse statement
  return {
    type: 'SET_HEADING_SIZE',
    data: {
      heading_size: reverse_heading_size,
    },
  };
};
