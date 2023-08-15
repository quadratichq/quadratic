import { TransactionSummary } from '../../quadratic-core/types';
import { SheetController } from './SheetController';

export class TransactionResponse {
  private sheetController: SheetController;

  constructor(sheetController: SheetController) {
    this.sheetController = sheetController;
  }

  handle(summary: TransactionSummary): void {
    if (summary.sheet_list_modified) {
      this.sheetController.repopulateSheets();
    }
  }
}
