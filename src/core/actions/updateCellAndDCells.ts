import { Cell } from '../gridDB/gridTypes';
import { runPython } from '../computations/python/runPython';
import { PixiApp } from '../gridGL/pixiApp/PixiApp';
import { Coordinate } from '../gridGL/types/size';
import { localFiles } from '../gridDB/localFiles';
import { SheetController } from '../transaction/sheetController';

export const updateCellAndDCells = async (sheet_controller: SheetController, starting_cell: Cell, app?: PixiApp) => {
  // start transaction
  sheet_controller.start_transaction();

  // keep track of cells that have been updated so we can update the quadrant cache
  const updatedCells: Coordinate[] = [];

  // start with a plan to just update the current cell
  let cells_to_update: [number, number][] = [[starting_cell.x, starting_cell.y]];

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

    // get cell from db or starting_cell if it is the starting cell passed in to this function
    let cell: Cell | undefined;
    if (ref_cell_to_update[0] === starting_cell.x && ref_cell_to_update[1] === starting_cell.y) {
      // if the ref_cell_to_update is the starting_cell, we need to used the passed in version
      // because it may contain code changes that are not yet in the DB.
      cell = starting_cell;
    } else {
      cell = sheet_controller.sheet.getCell(ref_cell_to_update[0], ref_cell_to_update[1])?.cell;
    }

    if (cell === undefined) continue;

    // remove old deps from graph
    if (cell.dependent_cells)
      sheet_controller.execute_statement({
        type: 'SET_CELL_DEPENDENCIES',
        data: { position: [cell.x, cell.y], dependencies: null },
      });

    // clear old array cells created by this cell
    if (cell.array_cells) {
      const old_array_cells = cell.array_cells.map((cell) => {
        return { x: cell[0], y: cell[1] };
      });
      old_array_cells.unshift(); // remove this cell

      // delete old array cells
      old_array_cells.forEach((cell) => {
        sheet_controller.execute_statement({
          type: 'SET_CELL',
          data: { position: [cell.x, cell.y], value: undefined },
        });
      });
      updatedCells.push(...old_array_cells);
    }

    if (cell.type === 'PYTHON') {
      // run cell and format results
      let result = await runPython(cell.python_code || '');
      let consoleOut = [result.input_python_stack_trace, result.input_python_std_out].join('\n');

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
        sheet_controller.execute_statement({
          type: 'SET_CELL_DEPENDENCIES',
          data: { position: [cell.x, cell.y], dependencies: result.cells_accessed },
        });
      }

      let array_cells_to_output: Cell[] = [];

      // if array output
      if (result.array_output) {
        if (result.array_output[0][0] !== undefined && typeof result.array_output[0] !== 'string') {
          // 2d array
          let y_offset = 0;
          for (const row of result.array_output) {
            let x_offset = 0;
            for (const cell of row) {
              if (cell !== undefined)
                array_cells_to_output.push({
                  x: ref_cell_to_update[0] + x_offset,
                  y: ref_cell_to_update[1] + y_offset,
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
          console.log(typeof sheet_controller.sheet.dgraph);
          let deps = sheet_controller.sheet.dgraph.get([array_cell.x, array_cell.y]);

          if (deps) cells_to_update.push(...deps);
        }

        // keep track of array cells updated by this cell
        cell.array_cells = array_cells_to_output.map((a_cell) => [a_cell.x, a_cell.y]);

        cell.last_modified = new Date().toISOString();

        [cell, ...array_cells_to_output].forEach((cell) => {
          sheet_controller.execute_statement({
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

        sheet_controller.execute_statement({
          type: 'SET_CELL',
          data: { position: [cell.x, cell.y], value: cell },
        });
      }
    }

    // if this cell updates other cells add them to the list to update
    let deps = sheet_controller.sheet.dgraph.get([cell.x, cell.y]);

    if (deps) cells_to_update.push(...deps);
  }

  // Officially end the transaction
  sheet_controller.end_transaction();

  // Pass updatedCells to the app so it can update the Grid Quadrants which changed.
  // TODO: move this to sheetController so it happens automatically with every transaction?
  // Maybe sheet_controller.end_transaction() should return a list of cells which updated in the transaction?
  app?.quadrants.quadrantChanged({ cells: updatedCells });

  // TODO: move this to sheetController so we can better control when it is called?
  localFiles.saveLastLocal(sheet_controller.sheet.export_file());
};
