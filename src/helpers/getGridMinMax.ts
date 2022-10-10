import { qdb } from '../core/gridDB/db';

export const getGridMinMax = async () => {
  // Calculates bounds of the content in the current grid
  let x_min = await qdb.cells.orderBy('x').first();
  let x_max = await qdb.cells.orderBy('x').last();
  let y_min = await qdb.cells.orderBy('y').first();
  let y_max = await qdb.cells.orderBy('y').last();

  if (x_min && x_max && y_min && y_max) {
    return [
      { x: x_min.x, y: y_min.y },
      { x: x_max.x, y: y_max.y },
    ];
  } else {
    return undefined;
  }
};

export const getGridColumnMinMax = async (column: number) => {
  const columnArray = await qdb.cells.where('x').equals(column).toArray();
  if (columnArray.length) {
    return [
      { x: column, y: columnArray[0].y },
      { x: column, y: columnArray[columnArray.length - 1].y },
    ];
  }
}

export const getGridRowMinMax = async (row: number) => {
  const rowArray = await qdb.cells.where('y').equals(row).toArray();
  if (rowArray.length) {
    return [
      { x: rowArray[0].x, y: row },
      { x: rowArray[rowArray.length - 1].x, y: row },
    ];
  }
}