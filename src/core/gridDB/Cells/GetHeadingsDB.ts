import { qdb, Heading } from '../db';

export const GetHeadingsDB = async (
): Promise<{ rows: Heading[], columns: Heading[] }> => {
  // Return Cells as an Array
  return {
    columns: await qdb.columns.toArray(),
    rows: await qdb.rows.toArray(),
  };
};
