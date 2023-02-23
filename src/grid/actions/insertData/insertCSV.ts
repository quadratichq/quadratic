import { Coordinate } from '../../../gridGL/types/size';
import { SheetController } from '../../controller/sheetController';
// import { Cell } from '../../sheet/gridTypes';
// import { updateCellAndDCells } from '../updateCellAndDCells';
import * as Papa from 'papaparse';

export const InsertCSV = async (props: {
  file: File;
  insertAtCellLocation: Coordinate;
  sheetController: SheetController;
}) => {
  const { file } = props;

  Papa.parse(file, {
    complete: function (results) {
      console.log('Async parse results:', results);
    },
  });
};
