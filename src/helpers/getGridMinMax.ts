import { qdb } from '../core/gridDB/db';

export const getGridMinMax = async () => {
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
