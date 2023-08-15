import { Coordinate } from '../../../gridGL/types/size';
import { SheetController } from '../../controller/SheetController';
// import { Cell } from '../../sheet/gridTypes';
// import { updateCellAndDCells } from '../updateCellAndDCells';
import mixpanel from 'mixpanel-browser';
import * as Papa from 'papaparse';
import { Cell } from '../../../schemas';
import { updateCellAndDCells } from '../updateCellAndDCells';

export const InsertCSV = (props: {
  file: File;
  insertAtCellLocation: Coordinate;
  sheetController: SheetController;
  reportError: (error: string) => void;
}) => {
  const { file } = props;
  props.sheetController.start_transaction();

  let rowIndex = 0;
  Papa.parse(file, {
    error: function (error, File) {
      props.reportError(error.name + ': ' + error.message);
      mixpanel.track('[Grid].[Actions].insertCSV', { status: 'error', name: error.name, message: error.message });
    },
    complete: function () {
      props.sheetController.end_transaction();
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
        sheetController: props.sheetController,
        create_transaction: false,
      });
    },
  });
};
