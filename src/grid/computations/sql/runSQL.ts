import * as duckdb from '@duckdb/duckdb-wasm';
import duckdb_wasm from '@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm';
import duckdb_wasm_next from '@duckdb/duckdb-wasm/dist/duckdb-eh.wasm';
import type { AsyncDuckDB } from '@duckdb/duckdb-wasm';

const MANUAL_BUNDLES: duckdb.DuckDBBundles = {
  mvp: {
    mainModule: duckdb_wasm,
    mainWorker: new URL('@duckdb/duckdb-wasm/dist/duckdb-browser-mvp.worker.js', import.meta.url).toString(),
  },
  eh: {
    mainModule: duckdb_wasm_next,
    mainWorker: new URL('@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js', import.meta.url).toString(),
  },
};

let db: AsyncDuckDB | null = null;

export interface runSQLReturnType {
  output_value: string | null;
  stderr: string | undefined;
  array_output?: (string | number | boolean)[][];
}

export const initDB = async () => {
  if (db) {
    return db; // Return existing database, if any
  }

  // Select a bundle based on browser checks
  const bundle = await duckdb.selectBundle(MANUAL_BUNDLES);
  // Instantiate the asynchronous version of DuckDB-wasm
  const worker = new Worker(bundle.mainWorker!);
  const logger = new duckdb.ConsoleLogger();
  db = new duckdb.AsyncDuckDB(logger, worker);
  await db.instantiate(bundle.mainModule, bundle.pthreadWorker);

  return db;
};

export async function runSQL(sql_statement: string): Promise<runSQLReturnType> {
  if (!db) {
    await initDB();
  }
  if (!db) {
    throw new Error('DuckDB database not initialized');
  }

  try {
    const conn = await db.connect();

    // Either materialize the query result
    const result = await conn.query(sql_statement);

    // Close the connection to release memory
    await conn.close();

    // Initialize an empty 2D array of strings
    const resultArray: string[][] = [];

    // Add column names as the first row
    const columnNames = result.schema.fields.map((field) => field.name);
    resultArray.push(columnNames);

    // Iterate through the table's batches
    result.batches.forEach((recordBatch) => {
      // Iterate through the table's rows
      const numCols = recordBatch.schema.fields.length;
      const numRows = recordBatch.numRows;

      // Iterate through the rows of the recordBatch
      for (let row = 0; row < numRows; row++) {
        // Initialize an empty rowData array
        const rowData = [];

        // Iterate through the columns of the recordBatch
        for (let col = 0; col < numCols; col++) {
          // Get the column data by column index
          const column = recordBatch.getChildAt(col);
          // Get the value at the specific row for the current column
          const cellData = column?.get(row);
          // Convert the cell data to a string and add it to the rowData array
          rowData.push(cellData.toString());
        }
        // Add rowData to the resultArray
        resultArray.push(rowData);
      }
    });

    return {
      output_value: null,
      array_output: resultArray,
    } as runSQLReturnType;
  } catch (error: any) {
    return {
      output_value: null,
      stderr: error.toString(),
      array_output: [],
    } as runSQLReturnType;
  }
}
