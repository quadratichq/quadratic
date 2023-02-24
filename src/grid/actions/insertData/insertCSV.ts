import { Coordinate } from '../../../gridGL/types/size';
import { SheetController } from '../../controller/sheetController';
// import { Cell } from '../../sheet/gridTypes';
// import { updateCellAndDCells } from '../updateCellAndDCells';
import * as Papa from 'papaparse';
import { updateCellAndDCells } from '../updateCellAndDCells';
import { Cell } from '../../sheet/gridTypes';

export const InsertCSV = (props: {
  file: File;
  insertAtCellLocation: Coordinate;
  sheetController: SheetController;
}) => {
  const { file } = props;
  props.sheetController.start_transaction();

  let rowIndex = 0;
  Papa.parse(file, {
    complete: function () {
      props.sheetController.end_transaction();
    },
    step: function (row) {
      const cellsToInsert: Cell[] = [];

      // results.data.forEach((row, rowIndex) => {
      //@ts-expect-error
      row.data.forEach((text, cellIndex) => {
        cellsToInsert.push({
          value: text.trim(),
          type: 'TEXT',
          x: props.insertAtCellLocation.x + cellIndex,
          y: props.insertAtCellLocation.y + rowIndex,
          last_modified: new Date().toISOString(),
        });
      });
      rowIndex++;
      // });

      updateCellAndDCells({
        starting_cells: cellsToInsert,
        sheetController: props.sheetController,
        create_transaction: false,
      });
    },
  });
};
