import { SheetController } from '../sheetController';
import { Statement } from '../statement';

export const SetBorderRunner = (sheetController: SheetController, statement: Statement): Statement => {
  if (statement.type !== 'SET_BORDER') throw new Error('Incorrect statement type.');
  // Applies the SET_BORDER statement to the sheet and returns the reverse statement

  const { border } = statement.data;
  const sheet = sheetController.sheet;

  // create reverse statement
  let reverse_statement = { ...statement };
  reverse_statement.data.border = sheet.borders.get(statement.data.position[0], statement.data.position[1]);

  // set border
  if (border === undefined || (!border.horizontal && !border.vertical)) {
    sheet.borders.clear([{ x: statement.data.position[0], y: statement.data.position[1] }]);
  } else {
    sheet.borders.update([border]);
  }

  // return reverse statement
  return reverse_statement;
};
