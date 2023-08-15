import { TransactionSummary } from '../../quadratic-core/types';
import { SheetController } from './SheetController';

export const transactionResponse = (sheetController: SheetController, summary: TransactionSummary): void => {
  if (summary.sheet_list_modified) {
    sheetController.repopulateSheets();
  }
};
