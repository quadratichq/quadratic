import { PixiApp } from '../../../gridGL/pixiApp/PixiApp';
import { Statement } from '../statement';

export const SetSheetRunner = (statement: Statement, app: PixiApp): Statement => {
  if (statement.type !== 'SET_SHEET') throw new Error('Incorrect statement type.');

  // create reverse statement
  const reverse_statement: Statement = { type: 'SET_SHEET', data: { sheetId: statement.data.sheetId } };
  if (!statement.data.sheet) {
    const sheet = app.sheet_controller.getSheet(statement.data.sheetId);
    if (!sheet) {
      throw new Error('Expected to find sheet in setSheetRunner');
    }
    reverse_statement.data.sheet = sheet;
  } else {
    statement.data.sheet = undefined;
  }

  if (statement.data.sheet) {
    app.sheet_controller.addSheet(statement.data.sheet);
  } else {
    app.sheet_controller.deleteSheet(statement.data.sheetId);
  }

  // return reverse statement
  return reverse_statement;
};
