import Cell from "../../../core/grid/Cell";

declare global {
  // <- [reference](https://stackoverflow.com/a/56458070/11542903)
  interface Window {
    pyodide: any;
    languagePluginLoader: any;
  }
}

export async function loadPython(grid_data: {
  [key: string]: { [key: string]: Cell };
}) {
  let grid: { [key: string]: { [key: string]: string } } = {};
  for (const row in grid_data) {
    for (const col in grid_data[row]) {
      const cell = grid_data[row][col];

      if (grid[row] === undefined) {
        grid[row] = {};
      }

      grid[row][col] = cell.bitmap_text.text;
    }
  }
  console.log(grid);

  await window.languagePluginLoader;
  await window.pyodide.registerJsModule("ns_grid", { grid });
  //   await window.pyodide.loadPackage([]);
  await window.pyodide.loadPackage(["numpy", "pandas"]);
  const output = await window.pyodide.runPython(`
import pandas as pd
import numpy as np
from ns_grid import grid

pgrid = grid.to_py()
print(pgrid)

grid_df = pd.DataFrame(
  data=pgrid,
  columns=[x for x in range(len(pgrid['0']))],
)
print(grid_df)
      `);
  // console.log(output);
}
