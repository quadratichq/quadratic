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

      // if array output
      console.log("result?.array_output", result);
      let array_cells_to_output: Cell[] = [];
      if (result.array_output) {
        if (result.array_output[0][0] !== undefined) {
          // 2d array
          console.log("2d");
          let x_offset = 0;
          for (const row of result.array_output) {
            let y_offset = 0;
            for (const cell of row) {
              array_cells_to_output.push({
                x: ref_cell_to_update[0] + x_offset,
                y: ref_cell_to_update[1] + y_offset,
                type: "COMPUTED",
                value: cell.toString(),
              });
              y_offset++;
            }
            x_offset++;
          }
        } else {
          // 1d array
          console.log("1d");
          let x_offset = 0;
          for (const cell of result.array_output) {
            array_cells_to_output.push({
              x: ref_cell_to_update[0] + x_offset,
              y: ref_cell_to_update[1],
              type: "COMPUTED",
              value: cell.toString(),
            });
            x_offset++;
          }
        }
        // we can't override the og cell or we will lose our formula
        let would_override_og_cell = array_cells_to_output.shift();
        cell.value = would_override_og_cell?.value || "";
        array_cells_to_output.unshift(cell);

        UpdateCellsDB(array_cells_to_output);

        // if any updated cells have other cells depending on them, add to list to update
        for (const array_cell of array_cells_to_output) {
          // add new cell deps to graph
          // TODO remove old deps
          if (result.cells_accessed.length) {
            cell.dependent_cells = result.cells_accessed;
            dgraph.add_dependencies_to_graph(result.cells_accessed, [
              [array_cell.x, array_cell.y],
            ]);
          }

          let deps = dgraph.get_children_cells([array_cell.x, array_cell.y]);
          cells_to_update.push(...deps);
        }
      } else {
        // not array output
        // update current cell
        UpdateCellsDB([cell]);

        // add new cell deps to graph
        // TODO remove old deps
        if (result.cells_accessed.length) {
          cell.dependent_cells = result.cells_accessed;
          dgraph.add_dependencies_to_graph(result.cells_accessed, [
            [cell.x, cell.y],
          ]);
        }

        // if this cell updates other cells add them to the list to update
        let deps = dgraph.get_children_cells([cell.x, cell.y]);
        cells_to_update.push(...deps);
      }
    }
  }

  await UpdateDGraphDB(dgraph);
};
