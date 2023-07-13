import { SheetController } from '../sheetController';
import { Statement } from '../statement';

export const sheetRunner = (sheetController: SheetController, statement: Statement): Statement => {
  // add or delete sheets
  if (statement.type === 'SET_SHEET') {
    const reverse_statement: Statement = { type: 'SET_SHEET', data: { sheetId: statement.data.sheetId } };
    if (!statement.data.sheet) {
      const sheet = sheetController.getSheet(statement.data.sheetId);
      if (!sheet) {
        throw new Error('Expected to find sheet in setSheetRunner');
      }
      reverse_statement.data.sheet = sheet;
    }

    if (statement.data.sheet) {
      sheetController.addSheet(statement.data.sheet);
    } else {
      sheetController.deleteSheet(statement.data.sheetId);
    }

    // return reverse statement
    return reverse_statement;
  }

  // change attributes of sheet
  else if (statement.type === 'UPDATE_SHEET') {
    const sheetId = statement.data.sheetId;
    const sheet = sheetController.getSheet(sheetId);
    if (!sheet) throw new Error('Expected sheet to be defined in SetSheetRunner');
    let reverse_statement: Statement | undefined;

    // handle ordering
    if (statement.data.order !== undefined) {
      reverse_statement = { type: 'UPDATE_SHEET', data: { sheetId, order: sheet.order } };
      sheetController.reorderSheet({ id: sheetId, order: statement.data.order });
      sheetController.current = sheetId;
    } else if (statement.data.color !== undefined) {
      reverse_statement = { type: 'UPDATE_SHEET', data: { sheetId, color: sheet.color ?? null } };
      sheetController.changeSheetColor(sheetId, statement.data.color ?? undefined);
    }

    if (!reverse_statement) {
      throw new Error('Unhandled attribute in UPDATE_SHEET');
    }

    // return reverse statement
    return reverse_statement;
  }

  throw new Error('Incorrect statement type.');
};
