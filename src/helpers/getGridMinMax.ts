import { qdb } from '../core/gridDB/db';

export const getGridMinMax = async () => {
  // Calculates min of Cells in in qdb.cells
  if (qdb.cells.cells.length === 0) {
    return undefined;
  }

  const x_min = qdb.cells.cells.reduce(function (prev, curr) {
    return prev.x < curr.x ? prev : curr;
  });
  const x_max = qdb.cells.cells.reduce(function (prev, curr) {
    return prev.x > curr.x ? prev : curr;
  });
  const y_min = qdb.cells.cells.reduce(function (prev, curr) {
    return prev.y < curr.y ? prev : curr;
  });
  const y_max = qdb.cells.cells.reduce(function (prev, curr) {
    return prev.y > curr.y ? prev : curr;
  });

  return [
    { x: x_min.x, y: y_min.y },
    { x: x_max.x, y: y_max.y },
  ];
};

export const getGridColumnMinMax = async (column: number) => {
  const columnArray = qdb.cells.cells.filter((cell) => cell.x === column);
  if (columnArray.length) {
    return [
      { x: column, y: columnArray[0].y },
      { x: column, y: columnArray[columnArray.length - 1].y },
    ];
  }
};

export const getGridRowMinMax = async (row: number) => {
  const rowArray = qdb.cells.cells.filter((cell) => cell.y === row);
  if (rowArray.length) {
    return [
      { x: rowArray[0].x, y: row },
      { x: rowArray[rowArray.length - 1].x, y: row },
    ];
  }
};
