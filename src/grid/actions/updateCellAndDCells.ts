import { Cell } from '../sheet/gridTypes';
import { PixiApp } from '../../gridGL/pixiApp/PixiApp';
import { Coordinate } from '../../gridGL/types/size';
import { SheetController } from '../controller/sheetController';
import { runCellComputation } from '../computations/runCellComputation';

interface ArgsType {
  starting_cells: Cell[];
  sheetController: SheetController;
  app?: PixiApp;
  pyodide?: any;
  delete_starting_cells?: boolean;
  create_transaction?: boolean;
}

export const updateCellAndDCells = async (args: ArgsType) => {
  const { starting_cells, sheetController, app, pyodide, delete_starting_cells, create_transaction } = args;

  // start transaction
  if (create_transaction ?? true) sheetController.start_transaction();

  // keep track of cells that have been updated so we can update the quadrant cache
  const updatedCells: Coordinate[] = [];

  // start with a plan to just update the current cells
  let cells_to_update: [number, number][] = starting_cells.map((c) => [c.x, c.y]);

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
    const ref_current_cell = cells_to_update.shift();
    if (ref_current_cell === undefined) break;

    // get cell from db or starting_cell if it is the starting cell passed in to this function
    let cell = sheetController.sheet.getCellCopy(ref_current_cell[0], ref_current_cell[1]);
    let old_array_cells: Coordinate[] = [];

    // keep track of previous array cells for this cell
    old_array_cells =
      cell?.array_cells?.map((cell) => {
        return { x: cell[0], y: cell[1] };
      }) || [];
    old_array_cells.unshift(); // remove this cell

    // ref_current_cell is in starting_cells
    if (starting_cells.some((c) => c.x === ref_current_cell[0] && c.y === ref_current_cell[1])) {
      // if the ref_cell_to_update is the starting_cell
      // then we need to update the cell with data from the starting_cell

      const passed_in_cell = starting_cells.find((c) => c.x === ref_current_cell[0] && c.y === ref_current_cell[1]);
      if (passed_in_cell === undefined) continue;
      cell = { ...passed_in_cell };
    }

    if (cell === undefined) continue;

    // remove old deps from graph
    if (cell.dependent_cells)
      cell.dependent_cells.forEach((dcell) => {
        sheetController.execute_statement({
          type: 'REMOVE_CELL_DEPENDENCY',
          data: {
            position: dcell,
            updates: ref_current_cell,
          },
        });
      });

    // Compute cell value
    let array_cells_to_output: Cell[] = [];
    if (delete_starting_cells === true && starting_cells.some((c) => c.x === cell?.x && c.y === cell?.y)) {
      // we are deleting one of the starting cells
      // with delete_starting_cells = true
      // delete cell
      sheetController.execute_statement({
        type: 'SET_CELL',
        data: { position: [cell.x, cell.y], value: undefined },
      });
    } else {
      // We are evaluating a cell
      if (cell.type === 'PYTHON' || cell.type === 'FORMULA') {
        // run cell and format results
        // let result = await runPython(cell.python_code || '', pyodide);
        let result = await runCellComputation(cell, pyodide);
        cell.evaluation_result = result;

        // collect output
        if (result.success) {
          cell.value = result.output_value || '';
          if (cell.type === 'PYTHON') cell.python_code = result.formatted_code;
        } else {
          cell.value = ''; // clear value if python code fails
        }

        // add new cell deps to graph
        if (result.cells_accessed.length) {
          // add new deps to graph
          result.cells_accessed.forEach((cell_accessed) => {
            sheetController.execute_statement({
              type: 'ADD_CELL_DEPENDENCY',
              data: {
                position: cell_accessed,
                updates: ref_current_cell,
              },
            });
          });
        }

        // if array output
        if (result.array_output !== undefined && result.array_output.length > 0) {
          if (result.array_output[0][0] !== undefined && typeof result.array_output[0] !== 'string') {
            // 2d array
            let y_offset = 0;
            for (const row of result.array_output) {
              let x_offset = 0;
              for (const cell of row) {
                if (cell !== undefined)
                  array_cells_to_output.push({
                    x: ref_current_cell[0] + x_offset,
                    y: ref_current_cell[1] + y_offset,
                    type: 'COMPUTED',
                    value: cell.toString(),
                    last_modified: new Date().toISOString(),
                  });
                x_offset++;
              }
              y_offset++;
            }
          } else {
            // 1d array
            let y_offset = 0;
            for (const cell of result.array_output) {
              array_cells_to_output.push({
                x: ref_current_cell[0],
                y: ref_current_cell[1] + y_offset,
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

          // keep track of array cells updated by this cell
          cell.array_cells = array_cells_to_output.map((a_cell) => [a_cell.x, a_cell.y]);

          cell.last_modified = new Date().toISOString();

          array_cells_to_output.forEach((cell) => {
            sheetController.execute_statement({
              type: 'SET_CELL',
              data: { position: [cell.x, cell.y], value: cell },
            });
          });

          updatedCells.push(...array_cells_to_output);
        } else {
          // not array output

          // no array cells, because this was not an array return
          cell.array_cells = [];

          // update current cell
          cell.dependent_cells = result.cells_accessed;

          cell.last_modified = new Date().toISOString();
          sheetController.execute_statement({
            type: 'SET_CELL',
            data: { position: [cell.x, cell.y], value: cell },
          });
        }
      } else {
        // not python cell

        // update current cell
        cell.last_modified = new Date().toISOString();
        sheetController.execute_statement({
          type: 'SET_CELL',
          data: { position: [cell.x, cell.y], value: cell },
        });
      }
    }

    // we updated this cell
    updatedCells.push(cell);

    // for old array cells not in new array cells, delete them
    let array_cells_to_delete = old_array_cells.filter(
      (old_cell) => !array_cells_to_output.find((new_cell) => new_cell.x === old_cell.x && new_cell.y === old_cell.y)
    );

    // delete old array cells
    array_cells_to_delete.forEach((aCell) => {
      if (aCell.x === cell?.x && aCell.y === cell?.y) return; // don't delete the cell we just updated (it's in array_cells_to_output)
      sheetController.execute_statement({
        type: 'SET_CELL',
        data: { position: [aCell.x, aCell.y], value: undefined },
      });
    });

    // if any updated cells have other cells depending on them, add to list to update
    for (const array_cell of array_cells_to_output) {
      let deps = sheetController.sheet.cell_dependency.getDependencies([array_cell.x, array_cell.y]);
      if (deps) cells_to_update.push(...deps);
    }

    // any deleted cells have other cells depending on them, add to list to update
    for (const array_cell of array_cells_to_delete) {
      let deps = sheetController.sheet.cell_dependency.getDependencies([array_cell.x, array_cell.y]);
      if (deps) cells_to_update.push(...deps);
    }

    // if this cell updates other cells add them to the list to update
    let deps = sheetController.sheet.cell_dependency.getDependencies([cell.x, cell.y]);
    if (deps) cells_to_update.push(...deps);
  }

  // Officially end the transaction
  if (create_transaction ?? true) sheetController.end_transaction();

  // Pass updatedCells to the app so it can update the Grid Quadrants which changed.
  // TODO: move this to sheetController so it happens automatically with every transaction?
  // Maybe sheetController.end_transaction() should return a list of cells which updated in the transaction?
  app?.quadrants.quadrantChanged({ cells: updatedCells });
};
