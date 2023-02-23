import { Coordinate } from '../../../gridGL/types/size';
import { SheetController } from '../../controller/sheetController';
// import { Cell } from '../../sheet/gridTypes';
// import { updateCellAndDCells } from '../updateCellAndDCells';
import * as Papa from 'papaparse';
import { updateCellAndDCells } from '../updateCellAndDCells';
import { Cell } from '../../sheet/gridTypes';

export const InsertCSV = async (props: {
  file: File;
  insertAtCellLocation: Coordinate;
  sheetController: SheetController;
}) => {
  const { file } = props;

  Papa.parse(file, {
    complete: function (results) {
      console.log('Async parse results:', results);

      const cellsToInsert: Cell[] = [];

      results.data.forEach((row, rowIndex) => {
        //@ts-expect-error
        row.forEach((cell, cellIndex) => {
          cellsToInsert.push({
            value: cell,
            type: 'TEXT',
            x: props.insertAtCellLocation.x + cellIndex,
            y: props.insertAtCellLocation.y + rowIndex,
            last_modified: new Date().toISOString(),
          });
        });
      });

      updateCellAndDCells({
        starting_cells: cellsToInsert,
        sheetController: props.sheetController,
      });
    },
  });
};
