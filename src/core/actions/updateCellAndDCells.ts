import { Cell } from '../gridDB/db';
import { UpdateCellsDB } from '../gridDB/Cells/UpdateCellsDB';
import { runPython } from '../computations/python/runPython';
import { GetDGraphDB } from '../gridDB/DGraph/GetDGraphDB';
import { UpdateDGraphDB } from '../gridDB/DGraph/UpdateDGraphDB';
import { GetCellsDB } from '../gridDB/Cells/GetCellsDB';
import { DeleteCellsDB } from '../gridDB/Cells/DeleteCellsDB';

export const updateCellAndDCells = async (cell: Cell) => {
  //save currently edited cell
  cell.last_modified = new Date().toISOString();
  await UpdateCellsDB([cell]);
  let dgraph = await GetDGraphDB();

  // start with a plan to just update the current cell
  let cells_to_update: [number, number][] = [[cell.x, cell.y]];

  // update cells, starting with the current cell
  while (cells_to_update.length > 0) {
    // dedupe cells_to_update
    let seen = Array<string>();
    for (let i = 0; i < cells_to_update.length; null) {
      let string_id = cells_to_update[i].join(',');

      if (seen.includes(string_id)) {
        cells_to_update.splice(i, 1);
      } else {
        i++;
      }

      seen.push(string_id);
    }

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

    // remove old deps from graph
    if (cell.dependent_cells)
      dgraph.remove_dependencies_from_graph(cell.dependent_cells, [
        [cell.x, cell.y],
      ]);

    // clear old array cells created by this cell
    if (cell.array_cells) {
      const old_array_cells = cell.array_cells.map((cell) => {
        return { x: cell[0], y: cell[1] };
      });
      // old_array_cells.unshift(); // remove this cell
      await DeleteCellsDB(old_array_cells);
    }

    if (cell.type === 'PYTHON') {
      // run cell and format results
      let result = await runPython(cell.python_code || '');
      let consoleOut = [
        result.input_python_stack_trace,
        result.input_python_std_out,
      ].join('\n');

      if (consoleOut[0] === '\n') consoleOut = consoleOut.substring(1);

      // collect output
      cell.python_output = consoleOut;
      if (result.input_python_evaluation_success) {
        cell.value = result.output_value || '';
        cell.python_code = result.formatted_code;
      }

      // add new cell deps to graph
      if (result.cells_accessed.length) {
        // add new deps to graph
        dgraph.add_dependencies_to_graph(result.cells_accessed, [
          [cell.x, cell.y],
        ]);
      }

      let array_cells_to_output: Cell[] = [];

      // if array output
      if (result.array_output) {
        if (
          result.array_output[0][0] !== undefined &&
          typeof result.array_output[0] !== 'string'
        ) {
          // 2d array
          let x_offset = 0;
          for (const row of result.array_output) {
            let y_offset = 0;
            for (const cell of row) {
              array_cells_to_output.push({
                x: ref_cell_to_update[0] + x_offset,
                y: ref_cell_to_update[1] + y_offset,
                type: 'COMPUTED',
                value: cell.toString(),
                last_modified: new Date().toISOString(),
              });
              y_offset++;
            }
            x_offset++;
          }
        } else {
          // 1d array
          let y_offset = 0;
          for (const cell of result.array_output) {
            array_cells_to_output.push({
              x: ref_cell_to_update[0],
              y: ref_cell_to_update[1] + y_offset,
              type: 'COMPUTED',
              value: cell.toString(),
              last_modified: new Date().toISOString(),
            });
            y_offset++;
          }
        }
        // we can't override the og cell or we will lose our formula
        let would_override_og_cell = array_cells_to_output.shift();
        cell.value = would_override_og_cell?.value || '';
        array_cells_to_output.unshift(cell);

        // if any updated cells have other cells depending on them, add to list to update
        for (const array_cell of array_cells_to_output) {
          // add array cells to list to update
          let deps = dgraph.get_children_cells([array_cell.x, array_cell.y]);
          cells_to_update.push(...deps);
        }

        // keep track of array cells updated by this cell
        cell.array_cells = array_cells_to_output.map((a_cell) => [
          a_cell.x,
          a_cell.y,
        ]);

        cell.last_modified = new Date().toISOString();

        await UpdateCellsDB([cell, ...array_cells_to_output]);
      } else {
        // not array output

        // no array cells, because this was not an array return
        cell.array_cells = [];

        // update current cell
        cell.dependent_cells = result.cells_accessed;
        await UpdateCellsDB([cell]);
      }
    }

    // if this cell updates other cells add them to the list to update
    let deps = dgraph.get_children_cells([cell.x, cell.y]);
    cells_to_update.push(...deps);
  }

  await UpdateDGraphDB(dgraph);
};
