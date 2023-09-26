import { Coordinate } from '../../../gridGL/types/size';
import { grid } from '../../controller/Grid';
import { sheets } from '../../controller/Sheets';
import { transactionResponse } from '../../controller/transactionResponse';

export const InsertCSV = async (props: {
  file: File;
  insertAtCellLocation: Coordinate;
  reportError: (error: string) => void;
}) => {
  const { file, insertAtCellLocation } = props;
  const cursor = sheets.sheet.cursor.getRectangle();

  const summary = await grid.importCsv(sheets.sheet.id, file, insertAtCellLocation, cursor);
  transactionResponse(summary);
};
