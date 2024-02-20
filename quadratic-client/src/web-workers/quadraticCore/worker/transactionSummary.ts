import { TransactionSummary } from '@/quadratic-core/types';
import { coreClient } from './coreClient';
import { coreRender } from './coreRender';

export const handleTransactionSummary = (summary: TransactionSummary) => {
  if (summary.cell_sheets_modified.length) {
    coreRender.cellSheetsModified(summary.cell_sheets_modified);
  }

  if (summary.fill_sheets_modified.length) {
    coreClient.fillSheetsModified(summary.fill_sheets_modified);
  }
};
