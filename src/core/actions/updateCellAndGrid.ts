import { Cell } from "../gridDB/db";
import { UpdateCellsDB } from "../gridDB/Cells/UpdateCellsDB";
import { runPython } from "../computations/python/runPython";
import { GetDGraphDB } from "../gridDB/DGraph/GetDGraphDB";
import { UpdateDGraphDB } from "../gridDB/DGraph/UpdateDGraphDB";
import { GetCellsDB } from "../gridDB/Cells/GetCellsDB";

export const updateCellAndGrid = async (cell: Cell) => {
  await UpdateCellsDB([cell]);
  let dgraph = await GetDGraphDB();

  // start with a plan to just update the current cell
  let cells_to_update: [number, number][] = [[cell.x, cell.y]];

  // update cells, starting with the current cell
  while (cells_to_update.length > 0) {
    // get next cell to update
    const ref_cell_to_update = cells_to_update.shift();
    if (ref_cell_to_update === undefined) break;

    // get current cell from db
    let cell = (
      await GetCellsDB(
        ref_cell_to_update[0],
        ref_cell_to_update[1],
        ref_cell_to_update[0],
        ref_cell_to_update[1]
      )
    )[0];

    if (cell === undefined) continue;

    if (cell.type === "PYTHON") {
      // run cell and format results
      let result = await runPython(cell.python_code || "");
      let consoleOut = [
        result.input_python_stack_trace,
        result.input_python_std_out,
      ]
        .join("")
        .trim();

      // collect output
      cell.python_output = consoleOut;
      if (result.input_python_evaluation_success) {
        cell.value = result.output_value || "";
        cell.python_code = result.formatted_code;
      }

      // add new cell deps to graph
      // TODO remove old deps
      if (result.cells_accessed.length) {
        cell.dependent_cells = result.cells_accessed;
        dgraph.add_dependencies_to_graph(result.cells_accessed, [
          [cell.x, cell.y],
        ]);
      }
    }

    // update current cell
    UpdateCellsDB([cell]);

    // if this cell updates other cells add them to the list to update
    let deps = dgraph.get_children_cells([cell.x, cell.y]);
    cells_to_update.push(...deps);
  }

  await UpdateDGraphDB(dgraph);
};
