import { SheetController } from '../sheetController';
import { Cell } from '../../../schemas';
import { setupPython } from '../../computations/python/loadPython';
import { updateCellAndDCells } from '../../actions/updateCellAndDCells';
import { GetCellsDBSetSheet } from '../../sheet/Cells/GetCellsDB';
import { DeleteCells } from '../../actions/DeleteCells';

// Setup Pyodide before tests
let pyodide: any;
beforeAll(async () => {
  const { loadPyodide } = require('pyodide');
  pyodide = await loadPyodide();
  await setupPython(pyodide);
});

test('SheetController - cell update when being deleted', async () => {
  const sc = new SheetController();
  GetCellsDBSetSheet(sc.sheet); // makes sheet available to Python

  const cell_0_0 = {
    x: 0,
    y: 0,
    value: '10',
    type: 'TEXT',
  } as Cell;

  const cell_0_1 = {
    x: 0,
    y: 1,
    value: '',
    type: 'PYTHON',
    python_code: 'c(0,0) * 2',
  } as Cell;

  await updateCellAndDCells({ starting_cells: [cell_0_0], sheetController: sc, pyodide });
  await updateCellAndDCells({ starting_cells: [cell_0_1], sheetController: sc, pyodide });

  const cell_after = sc.sheet.grid.getCell(0, 1);
  expect(cell_after?.value).toBe('20');

  // test value update
  const cell_0_0_update = {
    x: 0,
    y: 0,
    value: '20',
    type: 'TEXT',
  } as Cell;

  await updateCellAndDCells({ starting_cells: [cell_0_0_update], sheetController: sc, pyodide });

  const cell_after_update = sc.sheet.grid.getCell(0, 1);
  expect(cell_after_update?.value).toBe('40');

  // test deleting cell 0,0 update
  await updateCellAndDCells({
    starting_cells: [{ ...cell_0_0 }],
    sheetController: sc,
    pyodide,
    delete_starting_cells: true,
  });

  const cell_after_delete_dependency = sc.sheet.grid.getCell(0, 1);
  expect(cell_after_delete_dependency?.value).toBe('');
});

test('SheetController - cell bulk update when deleting a range of cells', async () => {
  const sc = new SheetController();
  GetCellsDBSetSheet(sc.sheet); // makes sheet available to Python

  const cell_0_0 = {
    x: 0,
    y: 0,
    value: '',
    type: 'PYTHON',
    python_code: '[2, 4, 6, 8]',
  } as Cell;

  const cell_1_0 = {
    x: 1,
    y: 0,
    value: '',
    type: 'PYTHON',
    python_code: 'c(0,0) * 2',
  } as Cell;

  const cell_1_1 = {
    x: 1,
    y: 1,
    value: '',
    type: 'PYTHON',
    python_code: 'c(0,1) * 2',
  } as Cell;

  const cell_1_2 = {
    x: 1,
    y: 2,
    value: '',
    type: 'PYTHON',
    python_code: 'c(0,2) * 2',
  } as Cell;

  const cell_1_3 = {
    x: 1,
    y: 3,
    value: '',
    type: 'PYTHON',
    python_code: 'c(0,3) * 2',
  } as Cell;

  await updateCellAndDCells({ starting_cells: [cell_0_0], sheetController: sc, pyodide });
  await updateCellAndDCells({ starting_cells: [cell_1_0], sheetController: sc, pyodide });
  await updateCellAndDCells({ starting_cells: [cell_1_1], sheetController: sc, pyodide });
  await updateCellAndDCells({ starting_cells: [cell_1_2], sheetController: sc, pyodide });
  await updateCellAndDCells({ starting_cells: [cell_1_3], sheetController: sc, pyodide });

  const cell_after_1_0 = sc.sheet.grid.getCell(1, 0);
  expect(cell_after_1_0?.value).toBe('4');
  const cell_after_1_1 = sc.sheet.grid.getCell(1, 1);
  expect(cell_after_1_1?.value).toBe('8');
  const cell_after_1_2 = sc.sheet.grid.getCell(1, 2);
  expect(cell_after_1_2?.value).toBe('12');
  const cell_after_1_3 = sc.sheet.grid.getCell(1, 3);
  expect(cell_after_1_3?.value).toBe('16');

  // try deleting cell bulk cells
  const cells_to_delete = sc.sheet.grid.getNakedCells(0, 0, 0, 3);
  await updateCellAndDCells({
    starting_cells: cells_to_delete,
    sheetController: sc,
    pyodide,
    delete_starting_cells: true,
  });

  // validate that all cells are now None after deletion
  const cells_after_delete_dependency = sc.sheet.grid.getNakedCells(1, 0, 1, 3);
  expect(cells_after_delete_dependency.length).toBe(4);
  cells_after_delete_dependency.forEach((cell) => {
    expect(cell.value).toBe('');
  });
});

test('SheetController - delete cell and array cells', async () => {
  const sc = new SheetController();
  GetCellsDBSetSheet(sc.sheet); // makes sheet available to Python

  const cell = {
    x: 0,
    y: 0,
    value: '',
    type: 'PYTHON',
    python_code: '[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]',
    last_modified: '2023-01-19T19:12:21.745Z',
  } as Cell;

  await updateCellAndDCells({ starting_cells: [cell], sheetController: sc, pyodide });

  const code_cell = sc.sheet.grid.getNakedCells(0, 0, 0, 0);
  expect(code_cell[0]?.value).toBe('1');
  expect(code_cell[0]?.python_code).toBe('[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]');
  expect(code_cell[0]?.evaluation_result?.std_out).toBe('');
  expect(code_cell[0]?.last_modified).toBeDefined();
  expect(code_cell[0]?.type).toBe('PYTHON');
  expect(code_cell[0]?.array_cells).toBeDefined();

  const after_code_run_cells = sc.sheet.grid.getNakedCells(0, 1, 0, 0);
  after_code_run_cells.forEach((cell, index) => {
    expect(cell.value).toEqual((cell.y + 1).toString());
    expect(cell.type).toEqual('COMPUTED');
  });

  // delete cells
  await DeleteCells({
    x0: 0,
    y0: 0,
    x1: 0,
    y1: 10,
    sheetController: sc,
    pyodide,
    create_transaction: true,
  });

  const after_delete = sc.sheet.grid.getNakedCells(0, 0, 0, 10);
  expect(after_delete.length).toBe(0);

  // undo

  sc.undo();

  const after_undo_code_cell = sc.sheet.grid.getNakedCells(0, 0, 0, 0);
  expect(after_undo_code_cell[0]?.value).toBe('1');
  expect(after_undo_code_cell[0]?.python_code).toBe('[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]');
  expect(after_undo_code_cell[0]?.evaluation_result?.std_out).toBe('');
  expect(after_undo_code_cell[0]?.last_modified).toBeDefined();
  expect(after_undo_code_cell[0]?.type).toBe('PYTHON');
  expect(after_undo_code_cell[0]?.array_cells).toBeDefined();

  const after_undo_cells = sc.sheet.grid.getNakedCells(0, 1, 0, 0);
  after_undo_cells.forEach((cell, index) => {
    expect(cell.value).toEqual((cell.y + 1).toString());
    expect(cell.type).toEqual('COMPUTED');
  });
});
