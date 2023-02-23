import { Coordinate } from '../../../gridGL/types/size';
import { SheetController } from '../../controller/sheetController';
import { Cell } from '../../sheet/gridTypes';
import { updateCellAndDCells } from '../updateCellAndDCells';

export const InsertTabSeparatedText = async (props: {
  text: string;
  insertAtCellLocation: Coordinate;
  sheetController: SheetController;
}) => {
  const { insertAtCellLocation, text, sheetController } = props;

  let cell_x: number = insertAtCellLocation.x;
  let cell_y: number = insertAtCellLocation.y;

  // build api payload
  let cells_to_write: Cell[] = [];
  let cells_to_delete: Coordinate[] = [];

  let str_rows: string[] = text.split('\n');

  // for each copied row
  str_rows.forEach((str_row) => {
    let str_cells: string[] = str_row.split('\t');

    // for each copied cell
    str_cells.forEach((str_cell) => {
      // update or clear cell
      if (str_cell !== '') {
        cells_to_write.push({
          x: cell_x,
          y: cell_y,
          type: 'TEXT',
          value: str_cell,
          last_modified: new Date().toISOString(),
        });
      } else {
        cells_to_delete.push({
          x: cell_x,
          y: cell_y,
        });
      }

      // move to next cell
      cell_x += 1;
    });

    // move to next row and return
    cell_y += 1;
    cell_x = insertAtCellLocation.x;
  });

  // TODO ALSO BE ABLE TO PASS CELLS TO DELETE TO updatecellandcells

  // bulk update and delete cells
  await updateCellAndDCells({
    starting_cells: cells_to_write,
    sheetController,
  });
};
