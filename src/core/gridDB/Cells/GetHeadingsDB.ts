import { qdb, Heading } from '../db';

export const GetHeadingsDB = (): { rows: Heading[]; columns: Heading[] } => {
  // Return Cells as an Array
  return {
    columns: qdb.columns.columns,
    rows: qdb.rows.rows,
  };
};
