import { qdb } from '../db';

export const UpdateHeadingDB = async (options: { row?: number, column?: number, size: number }) => {
  if (options.row !== undefined) {
    await qdb.rows.put({ id: options.row, size: options.size });
  } else if (options.column !== undefined) {
    await qdb.columns.put({ id: options.column, size: options.size });
  }
};
