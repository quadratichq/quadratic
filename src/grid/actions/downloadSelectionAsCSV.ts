import { downloadFile } from '@/helpers/downloadFileInBrowser';
import { grid } from '../controller/Grid';

export const downloadSelectionAsCSV = (fileName: string) => {
  const csv = grid.exportCsvSelection();
  downloadFile(fileName, csv, 'text/plain', 'csv');
};
