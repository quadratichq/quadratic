import { qdb } from '../db';

export interface UpdateHeading {
  row?: number;
  column?: number;
  size: number;
}

export interface DeleteHeadings {
  rows: number[];
  columns: number[];
}

export const updateHeadingDB = async (options: UpdateHeading): Promise<void> => {
  if (options.row !== undefined) {
    await qdb.rows.put({ id: options.row, size: options.size });
  } else if (options.column !== undefined) {
    await qdb.columns.put({ id: options.column, size: options.size });
  }
};

export const deleteHeadingDB = async (options: DeleteHeadings): Promise<void> => {
  if (options.rows.length) {
    await qdb.rows.bulkDelete(options.rows);
  }
  if (options.columns.length) {
    await qdb.columns.bulkDelete(options.columns);
  }
};