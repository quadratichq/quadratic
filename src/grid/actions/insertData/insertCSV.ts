import { Coordinate } from '../../../gridGL/types/size';
// import { Cell } from '../../sheet/gridTypes';
// import { updateCellAndDCells } from '../updateCellAndDCells';
import mixpanel from 'mixpanel-browser';
import * as Papa from 'papaparse';
import { Cell } from '../../../schemas';
import { sheetController } from '../../controller/SheetController';
import { updateCellAndDCells } from '../updateCellAndDCells';

export const InsertCSV = (props: {
  file: File;
  insertAtCellLocation: Coordinate;
  reportError: (error: string) => void;
}) => {
  const { file } = props;
  sheetController.start_transaction();

  let rowIndex = 0;
  Papa.parse(file, {
    error: function (error, File) {
      props.reportError(error.name + ': ' + error.message);
      mixpanel.track('[Grid].[Actions].insertCSV', { status: 'error', name: error.name, message: error.message });
    },
    complete: function () {
      sheetController.end_transaction();
      mixpanel.track('[Grid].[Actions].insertCSV', { status: 'complete' });
    },
    step: function (row) {
      const cellsToInsert: Cell[] = [];

      //@ts-expect-error
      row.data.forEach((text: string, cellIndex: number) => {
        cellsToInsert.push({
          value: text.trim(),
          type: 'TEXT',
          x: props.insertAtCellLocation.x + cellIndex,
          y: props.insertAtCellLocation.y + rowIndex,
          last_modified: new Date().toISOString(),
        });
      });
      rowIndex++;

      updateCellAndDCells({
        starting_cells: cellsToInsert,
        create_transaction: false,
      });
    },
  });
};
