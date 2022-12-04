import { qdb, Heading } from '../gridTypes';

export const GetHeadingsDB = async (): Promise<{ rows: Heading[]; columns: Heading[] }> => {
  // Return Cells as an Array
  return {
    columns: await qdb.columns.toArray(),
    rows: await qdb.rows.toArray(),
  };
};
