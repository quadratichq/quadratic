import { TransactionSummary } from '../../quadratic-core/types';
import { SheetController } from './SheetController';

const sheetListModified = (sheetController: SheetController): void => {
  sheetController.repopulateSheets();
}

export const transactionResponse = (sheetController: SheetController, summary: TransactionSummary) => void {
  if (summary.sheet_list_modified) {
    sheetListModified(sheetController);
  }

}

export class TransactionResponse {
  private sheetController: SheetController;

  constructor(sheetController: SheetController) {
    this.sheetController = sheetController;
  }

  handle(summary: TransactionSummary): void {
  }
}
