import { TransactionSummary } from '@/quadratic-core-types';
import { coreClient } from './coreClient';

export const handleTransactionSummary = (summary: TransactionSummary) => {
  if (summary.fill_sheets_modified.length) {
    coreClient.fillSheetsModified(summary.fill_sheets_modified);
  }
};
