import { SheetController } from '../sheetController';
import { Cell } from '../../../schemas';
import { setupPython } from '../../computations/python/loadPython';
import { updateCellAndDCells } from '../../actions/updateCellAndDCells';
import { GetCellsDBSetSheet } from '../../sheet/Cells/GetCellsDB';

// Setup Pyodide before tests
let pyodide: any;
beforeAll(async () => {
  const { loadPyodide } = require('pyodide');
  pyodide = await loadPyodide();
  await setupPython(pyodide);
});

test('SheetController - code run correctly', async () => {
  const sc = new SheetController();

  const cell = {
    x: 54,
    y: 54,
    value: '',
    type: 'PYTHON',
    python_code: "print('hello')\n'world'",
    last_modified: '2023-01-19T19:12:21.745Z',
  } as Cell;

  await updateCellAndDCells({ starting_cells: [cell], sheetController: sc, pyodide });

  const cell_after = sc.sheet.grid.getCell(54, 54);

  expect(cell_after?.value).toBe('world');
  expect(cell_after?.python_code).toBe("print('hello')\n'world'");
  expect(cell_after?.evaluation_result?.std_out).toBe('hello\n');
  expect(cell_after?.last_modified).toBeDefined();
  expect(cell_after?.type).toBe('PYTHON');
});

test('SheetController - array output undo redo', async () => {
  const sc = new SheetController();

  const cell = {
    x: 0,
    y: 0,
    value: '',
    type: 'PYTHON',
    python_code: '[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]',
    last_modified: '2023-01-19T19:12:21.745Z',
  } as Cell;

  await updateCellAndDCells({ starting_cells: [cell], sheetController: sc, pyodide });

  const after_code_run_cells = sc.sheet.grid.getNakedCells(0, 0, 0, 10);
  expect(after_code_run_cells[0]?.value).toBe('1');
  expect(after_code_run_cells[0]?.python_code).toBe('[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]');
  expect(after_code_run_cells[0]?.evaluation_result?.std_out).toBe('');
  expect(after_code_run_cells[0]?.last_modified).toBeDefined();
  expect(after_code_run_cells[0]?.type).toBe('PYTHON');
  expect(after_code_run_cells[0]?.array_cells).toBeDefined();
  after_code_run_cells.forEach((cell, index) => {
    expect(cell.value).toEqual((index + 1).toString());
    if (index === 0) return;

    expect(cell.type).toEqual('COMPUTED');
  });

  sc.undo();

  const after_undo_cells = sc.sheet.grid.getNakedCells(0, 0, 0, 10);

  expect(after_undo_cells.length).toBe(0);

  sc.redo();

  const after_redo_cells = sc.sheet.grid.getNakedCells(0, 0, 0, 10);
  expect(after_redo_cells.length).toBe(10);
  expect(after_redo_cells[0]?.value).toBe('1');
  expect(after_redo_cells[0]?.python_code).toBe('[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]');
  expect(after_redo_cells[0]?.evaluation_result?.std_out).toBe('');
  expect(after_redo_cells[0]?.last_modified).toBeDefined();
  expect(after_redo_cells[0]?.type).toBe('PYTHON');
  expect(after_redo_cells[0]?.array_cells).toBeDefined();
  after_redo_cells.forEach((cell, index) => {
    expect(cell.value).toEqual((index + 1).toString());
    if (index === 0) return;

    expect(cell.type).toEqual('COMPUTED');
  });
});

test('SheetController - array output length change', async () => {
  const sc = new SheetController();

  const cell = {
    x: 0,
    y: 0,
    value: '',
    type: 'PYTHON',
    python_code: '[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]',
    last_modified: '2023-01-19T19:12:21.745Z',
  } as Cell;

  await updateCellAndDCells({ starting_cells: [cell], sheetController: sc, pyodide });

  const after_code_run_cells = sc.sheet.grid.getNakedCells(0, 0, 0, 20);
  expect(after_code_run_cells[0]?.value).toBe('1');
  expect(after_code_run_cells[0]?.python_code).toBe('[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]');
  expect(after_code_run_cells[0]?.evaluation_result?.std_out).toBe('');
  expect(after_code_run_cells[0]?.last_modified).toBeDefined();
  expect(after_code_run_cells[0]?.type).toBe('PYTHON');
  expect(after_code_run_cells[0]?.array_cells?.length).toBe(10);
  expect(after_code_run_cells.length).toBe(10);
  after_code_run_cells.forEach((cell, index) => {
    expect(cell.value).toEqual((index + 1).toString());
    if (index === 0) return;
    expect(cell.type).toEqual('COMPUTED');
  });

  // SET TO A NEW FORMULA

  const cell_update_1 = {
    x: 0,
    y: 0,
    value: '',
    type: 'PYTHON',
    python_code: '["1new", "2new", "3new", "4new", "5new"]',
    last_modified: '2023-01-19T19:12:21.745Z',
  } as Cell;

  await updateCellAndDCells({ starting_cells: [cell_update_1], sheetController: sc, pyodide });

  const after_update_1 = sc.sheet.grid.getNakedCells(0, 0, 0, 20);
  expect(after_update_1.length).toBe(5);
  expect(sc.sheet.grid.getNakedCells(0, 5, 0, 20).length).toBe(0); // check that the old cells are gone
  expect(after_update_1[0]?.value).toBe('1new'); // verify code cell is set properly
  expect(after_update_1[0]?.python_code).toBe('["1new", "2new", "3new", "4new", "5new"]');
  expect(after_update_1[0]?.evaluation_result?.std_out).toBe('');
  expect(after_update_1[0]?.last_modified).toBeDefined();
  expect(after_update_1[0]?.type).toBe('PYTHON');
  expect(after_update_1[0]?.array_cells?.length).toBe(5);
  after_update_1.forEach((cell, index) => {
    expect(cell.value).toEqual((index + 1).toString() + 'new');
    if (index === 0) return;
    expect(cell.type).toEqual('COMPUTED');
  });

  // UNDO
  sc.undo();

  const after_undo_1 = sc.sheet.grid.getNakedCells(0, 0, 0, 20);
  expect(after_undo_1[0]?.value).toBe('1');
  expect(after_undo_1[0]?.python_code).toBe('[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]');
  expect(after_undo_1[0]?.evaluation_result?.std_out).toBe('');
  expect(after_undo_1[0]?.last_modified).toBeDefined();
  expect(after_undo_1[0]?.type).toBe('PYTHON');
  expect(after_undo_1[0]?.array_cells?.length).toBe(10);
  expect(after_undo_1.length).toBe(10);
  after_undo_1.forEach((cell, index) => {
    expect(cell.value).toEqual((cell.y + 1).toString());
    if (index === 0) return;
    expect(cell.type).toEqual('COMPUTED');
  });

  // UNDO

  sc.undo();
  expect(sc.sheet.grid.getNakedCells(0, 0, 0, 20).length).toBe(0);

  // REDO

  sc.redo();

  const after_redo_1 = sc.sheet.grid.getNakedCells(0, 0, 0, 20);
  expect(after_redo_1[0]?.value).toBe('1');
  expect(after_redo_1[0]?.python_code).toBe('[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]');
  expect(after_redo_1[0]?.evaluation_result?.std_out).toBe('');
  expect(after_redo_1[0]?.last_modified).toBeDefined();
  expect(after_redo_1[0]?.type).toBe('PYTHON');
  expect(after_redo_1[0]?.array_cells?.length).toBe(10);
  expect(after_redo_1.length).toBe(10);
  after_redo_1.forEach((cell, index) => {
    expect(cell.value).toEqual((cell.y + 1).toString());
    if (index === 0) return;
    expect(cell.type).toEqual('COMPUTED');
  });

  // REDO

  sc.redo();

  const after_redo_2 = sc.sheet.grid.getNakedCells(0, 0, 0, 20);
  expect(after_redo_2.length).toBe(5);
  expect(sc.sheet.grid.getNakedCells(0, 5, 0, 20).length).toBe(0); // check that the old cells are gone
  expect(after_redo_2[0]?.value).toBe('1new'); // verify code cell is set properly
  expect(after_redo_2[0]?.python_code).toBe('["1new", "2new", "3new", "4new", "5new"]');
  expect(after_redo_2[0]?.evaluation_result?.std_out).toBe('');
  expect(after_redo_2[0]?.last_modified).toBeDefined();
  expect(after_redo_2[0]?.type).toBe('PYTHON');
  expect(after_redo_2[0]?.array_cells?.length).toBe(5);
  after_redo_2.forEach((cell, index) => {
    expect(cell.value).toEqual((cell.y + 1).toString() + 'new');
    if (index === 0) return;
    expect(cell.type).toEqual('COMPUTED');
  });
});

test('SheetController - test array formula', async () => {
  const sc = new SheetController();
  GetCellsDBSetSheet(sc.sheet);

  const cell_0_0 = {
    x: 0,
    y: 0,
    value: '1',
    type: 'TEXT',
    last_modified: '2023-01-19T19:12:21.745Z',
  } as Cell;

  const cell_0_1 = {
    x: 0,
    y: 1,
    value: '2',
    type: 'TEXT',
    last_modified: '2023-01-19T19:12:21.745Z',
  } as Cell;

  const cell_0_2 = {
    x: 0,
    y: 2,
    value: '3',
    type: 'TEXT',
    last_modified: '2023-01-19T19:12:21.745Z',
  } as Cell;

  const cell_1_0 = {
    x: 1,
    y: 0,
    value: '',
    type: 'FORMULA',
    formula_code: 'A0:A2 * 2',
    last_modified: '2023-01-19T19:12:21.745Z',
  } as Cell;

  await updateCellAndDCells({ starting_cells: [cell_0_0, cell_0_1, cell_0_2, cell_1_0], sheetController: sc, pyodide });

  const after_code_run_cells = sc.sheet.grid.getNakedCells(1, 0, 1, 2);
  expect(after_code_run_cells[0]?.value).toBe('2');
  expect(after_code_run_cells[0]?.python_code).toBeUndefined();
  expect(after_code_run_cells[0]?.formula_code).toBe('A0:A2 * 2');
  expect(after_code_run_cells[0]?.evaluation_result?.std_out).toBeUndefined();
  expect(after_code_run_cells[0]?.last_modified).toBeDefined();
  expect(after_code_run_cells[0]?.type).toBe('FORMULA');
  expect(after_code_run_cells[0]?.array_cells?.length).toBe(3);
  expect(after_code_run_cells.length).toBe(3);
  after_code_run_cells.forEach((cell, index) => {
    expect(cell.value).toEqual(((cell.y + 1) * 2).toString());
    if (index === 0) return;
    expect(cell.type).toEqual('COMPUTED');
  });
});

test('SheetController - test DataFrame resizing', async () => {
  const sc = new SheetController();
  GetCellsDBSetSheet(sc.sheet);

  const cell_0_0 = {
    x: 0,
    y: 0,
    value: '10',
    type: 'TEXT',
    last_modified: '2023-01-19T19:12:21.745Z',
  } as Cell;

  await updateCellAndDCells({ starting_cells: [cell_0_0], sheetController: sc, pyodide });

  const cell_0_1 = {
    x: 0,
    y: 1,
    value: '10',
    type: 'PYTHON',
    python_code: `result = []
repeat = int(c(0,0))
for x in range(0, repeat):
  result.append(x + repeat)
result`,
    last_modified: '2023-01-19T19:12:21.745Z',
  } as Cell;

  await updateCellAndDCells({ starting_cells: [cell_0_1], sheetController: sc, pyodide });

  // Validate the dataframe is sized
  const code_cell_first_run = sc.sheet.grid.getNakedCells(0, 1, 0, 1)[0];
  expect(code_cell_first_run?.value).toBe('10');
  expect(code_cell_first_run?.array_cells?.length).toBe(10);
  expect(code_cell_first_run?.array_cells).toEqual([
    [0, 1],
    [0, 2],
    [0, 3],
    [0, 4],
    [0, 5],
    [0, 6],
    [0, 7],
    [0, 8],
    [0, 9],
    [0, 10],
  ]);

  // Now resize the dataframe
  const cell_0_0_update = {
    x: 0,
    y: 0,
    value: '5',
    type: 'TEXT',
    last_modified: '2023-01-19T19:12:21.745Z',
  } as Cell;

  await updateCellAndDCells({ starting_cells: [cell_0_0_update], sheetController: sc, pyodide });

  // Validate the dataframe is resized
  const code_cell_after_run = sc.sheet.grid.getNakedCells(0, 1, 0, 1)[0];
  expect(code_cell_after_run?.value).toBe('5');
  expect(code_cell_after_run?.array_cells?.length).toBe(5);
  expect(code_cell_after_run?.array_cells).toEqual([
    [0, 1],
    [0, 2],
    [0, 3],
    [0, 4],
    [0, 5],
  ]);

  // validate the dataframe is resized and old data is cleared
  const after_code_run_cells = sc.sheet.grid.getNakedCells(0, 1, 0, 10);
  expect(after_code_run_cells.length).toBe(5);
  after_code_run_cells.forEach((cell, index) => {
    expect(cell.value).toEqual((cell.y - 1 + 5).toString());
    if (index === 0) return;
    expect(cell.type).toEqual('COMPUTED');
  });
});

test('SheetController - test deleted array cells update dependent cells', async () => {
  const sc = new SheetController();
  GetCellsDBSetSheet(sc.sheet);

  const cell_1_2_dependent = {
    x: 1,
    y: 2,
    value: '10',
    type: 'PYTHON',
    python_code: `c(0,2) + 100`,
  } as Cell;

  await updateCellAndDCells({ starting_cells: [cell_1_2_dependent], sheetController: sc, pyodide });

  const cell_0_0 = {
    x: 0,
    y: 0,
    value: '',
    type: 'PYTHON',
    python_code: `[1,2,3,4,5,6,7,8,9,10]`,
  } as Cell;

  await updateCellAndDCells({ starting_cells: [cell_0_0], sheetController: sc, pyodide });

  // validate that the dependent cell is updated
  const after_code_run_cell = sc.sheet.grid.getNakedCells(1, 2, 1, 2);
  expect(after_code_run_cell.length).toBe(1);
  expect(after_code_run_cell[0]?.value).toBe('103');

  // Now shorten the array output
  const cell_0_0_update = {
    x: 0,
    y: 0,
    value: '',
    type: 'PYTHON',
    python_code: `[1,2]`,
  } as Cell;

  await updateCellAndDCells({ starting_cells: [cell_0_0_update], sheetController: sc, pyodide });

  // validate that the dependent cell is updated
  const after_code_run_cell_update = sc.sheet.grid.getNakedCells(1, 2, 1, 2);
  expect(after_code_run_cell_update.length).toBe(1);
  expect(after_code_run_cell_update[0]?.evaluation_result?.success).toBe(false);
  expect(after_code_run_cell_update[0]?.evaluation_result?.std_err).toBe(
    "TypeError on line 1: unsupported operand type(s) for +: 'NoneType' and 'int'"
  );
});

test('SheetController - test formula dependencies', async () => {
  const sc = new SheetController();
  GetCellsDBSetSheet(sc.sheet);

  const cell_0_0_dependent = {
    x: 0,
    y: 0,
    value: '',
    type: 'FORMULA',
    formula_code: 'A1+A2',
  } as Cell;

  await updateCellAndDCells({ starting_cells: [cell_0_0_dependent], sheetController: sc, pyodide });

  let after_code_run_cells = sc.sheet.grid.getNakedCells(0, 0, 0, 0);
  expect(after_code_run_cells[0]?.value).toBe('0');

  const cell_0_1 = {
    x: 0,
    y: 1,
    value: '10',
    type: 'TEXT',
  } as Cell;

  await updateCellAndDCells({ starting_cells: [cell_0_1], sheetController: sc, pyodide });

  after_code_run_cells = sc.sheet.grid.getNakedCells(0, 0, 0, 0);
  expect(after_code_run_cells[0]?.value).toBe('10');

  const cell_0_2 = {
    x: 0,
    y: 2,
    value: '20',
    type: 'TEXT',
  } as Cell;

  await updateCellAndDCells({ starting_cells: [cell_0_2], sheetController: sc, pyodide });

  after_code_run_cells = sc.sheet.grid.getNakedCells(0, 0, 0, 0);
  expect(after_code_run_cells[0]?.value).toBe('30');
});
