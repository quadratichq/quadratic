import { TransactionSummary } from '../../quadratic-core/types';
import { SheetCursorSave } from '../sheet/SheetCursor';
import { SheetController } from './SheetController';

export const transactionResponse = (sheetController: SheetController, summary: TransactionSummary): void => {
  if (summary.sheet_list_modified) {
    sheetController.repopulateSheets();
  }
  const cursor = summary.cursor ? (JSON.parse(summary.cursor) as SheetCursorSave) : undefined;
  if (cursor) {
    sheetController.current = cursor.sheetId;
    sheetController.sheet.cursor.load(cursor);
    sheetController.updateSheetBar();
  }
};
