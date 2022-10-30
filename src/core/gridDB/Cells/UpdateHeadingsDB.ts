import { qdb } from '../db';

export interface UpdateHeading {
  row?: number;
  column?: number;
  size: number;
}

export const updateHeadingDB = async (options: UpdateHeading): Promise<void> => {
  if (options.row !== undefined) {
    await qdb.rows.put({ id: options.row, size: options.size });
  } else if (options.column !== undefined) {
    await qdb.columns.put({ id: options.column, size: options.size });
  }
};
