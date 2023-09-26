import { Coordinate } from '../../../gridGL/types/size';
import { grid } from '../../controller/Grid';
import { sheets } from '../../controller/Sheets';

export const InsertCSV = (props: {
  file: File;
  insertAtCellLocation: Coordinate;
  reportError: (error: string) => void;
}) => {
  const { file, insertAtCellLocation } = props;

  grid.importCsv(sheets.sheet.id, file, insertAtCellLocation);
};
