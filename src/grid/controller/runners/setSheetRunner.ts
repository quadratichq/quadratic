import { PixiApp } from '../../../gridGL/pixiApp/PixiApp';
import { Statement } from '../statement';

export const SetSheetRunner = (statement: Statement, app: PixiApp): Statement => {
  if (statement.type === 'SET_SHEET') {
    const reverse_statement: Statement = { type: 'SET_SHEET', data: { sheetId: statement.data.sheetId } };
    if (!statement.data.sheet) {
      const sheet = app.sheet_controller.getSheet(statement.data.sheetId);
      if (!sheet) {
        throw new Error('Expected to find sheet in setSheetRunner');
      }
      reverse_statement.data.sheet = sheet;
    }

    if (statement.data.sheet) {
      app.sheet_controller.addSheet(statement.data.sheet);
    } else {
      app.sheet_controller.deleteSheet(statement.data.sheetId);
    }

    // return reverse statement
    return reverse_statement;
  } else if (statement.type === 'SET_SHEET_ORDER') {
    const sheetId = statement.data.sheetId;
    const sheet = app.sheet_controller.getSheet(sheetId);
    if (!sheet) throw new Error('Expected sheet to be defined in SetSheetRunner');
    const reverse_statement: Statement = { type: 'SET_SHEET_ORDER', data: { sheetId, order: sheet.order } };
    app.sheet_controller.reorderSheet({ id: sheetId, order: statement.data.order, delta: statement.data.delta });

    // return reverse statement
    return reverse_statement;
  }

  throw new Error('Incorrect statement type.');
};
