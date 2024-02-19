import { TransactionSummary } from '@/quadratic-core/types';
import { coreRender } from './coreRender';

export const handleTransactionSummary = (summary: TransactionSummary) => {
  if (summary.cell_sheets_modified.length) {
    coreRender.cellSheetsModified(summary.cell_sheets_modified);
  }
};
