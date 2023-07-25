import { pixiAppEvents } from '../../../gridGL/pixiApp/PixiAppEvents';
import { Cell } from '../../../schemas';
import { mockPixiApp } from '../../../setupPixiTests';
import { webWorkers } from '../../../web-workers/webWorkers';
import { updateCellAndDCells } from '../../actions/updateCellAndDCells';
import { GetCellsDBSetSheet } from '../../sheet/Cells/GetCellsDB';
import { SheetController } from '../sheetController';
import { mockPythonOutput } from './mockPythonOutput';

jest.mock('../../../web-workers/pythonWebWorker/PythonWebWorker');

let sc: SheetController;
beforeAll(async () => {
  pixiAppEvents.app = mockPixiApp();
  sc = new SheetController();
  GetCellsDBSetSheet(sc.sheet);
  pixiAppEvents.app.sheet_controller = sc;
  webWorkers.init(pixiAppEvents.app);
});

beforeEach(() => {
  sc.clear();
  sc.sheet.clear();
});

test('SheetController - code run correctly', async () => {
  const cell = {
    x: 54,
    y: 54,
    value: '',
    type: 'PYTHON',
    python_code: "print('hello')\n'world'",
    last_modified: '2023-01-19T19:12:21.745Z',
  } as Cell;

  mockPythonOutput({
    "print('hello')\n'world'": `{"output_value":"world","cells_accessed":[],"input_python_std_out":"hello\\n","success":true,"formatted_code":"print('hello')\\n'world'\\n"}`,
  });
  await updateCellAndDCells({ starting_cells: [cell], sheetController: sc });

  const cell_after = sc.sheet.grid.getCell(54, 54);

  expect(cell_after?.value).toBe('world');
  expect(cell_after?.python_code).toBe("print('hello')\n'world'");
  expect(cell_after?.evaluation_result?.std_out).toBe('hello\n');
  expect(cell_after?.last_modified).toBeDefined();
  expect(cell_after?.type).toBe('PYTHON');
});

test('SheetController - array output undo redo', async () => {
  const cell = {
    x: 0,
    y: 0,
    value: '',
    type: 'PYTHON',
    python_code: '[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]',
    last_modified: '2023-01-19T19:12:21.745Z',
  } as Cell;

  mockPythonOutput({
    '[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]': `{"output_value":"[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]","array_output":[1,2,3,4,5,6,7,8,9,10],"cells_accessed":[],"input_python_std_out":"","success":true,"formatted_code":"[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]\\n"}`,
  });
  await updateCellAndDCells({ starting_cells: [cell], sheetController: sc });

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
  const cell = {
    x: 0,
    y: 0,
    value: '',
    type: 'PYTHON',
    python_code: '[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]',
    last_modified: '2023-01-19T19:12:21.745Z',
  } as Cell;

  mockPythonOutput({
    '[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]': `{"output_value":"[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]","array_output":[1,2,3,4,5,6,7,8,9,10],"cells_accessed":[],"input_python_std_out":"","success":true,"formatted_code":"[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]\\n"}`,
  });
  await updateCellAndDCells({ starting_cells: [cell], sheetController: sc });

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
  mockPythonOutput({
    '["1new", "2new", "3new", "4new", "5new"]': `{"output_value":"['1new', '2new', '3new', '4new', '5new']","array_output":["1new","2new","3new","4new","5new"],"cells_accessed":[],"input_python_std_out":"","success":true,"formatted_code":"[\\"1new\\", \\"2new\\", \\"3new\\", \\"4new\\", \\"5new\\"]\\n"}`,
  });
  await updateCellAndDCells({ starting_cells: [cell_update_1], sheetController: sc });

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

  await updateCellAndDCells({ starting_cells: [cell_0_0, cell_0_1, cell_0_2, cell_1_0], sheetController: sc });

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
  const cell_0_0 = {
    x: 0,
    y: 0,
    value: '10',
    type: 'TEXT',
    last_modified: '2023-01-19T19:12:21.745Z',
  } as Cell;

  await updateCellAndDCells({ starting_cells: [cell_0_0], sheetController: sc });

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

  mockPythonOutput({
    'result = []\nrepeat = int(c(0,0))\nfor x in range(0, repeat):\n  result.append(x + repeat)\nresult': `{"output_value":"[10, 11, 12, 13, 14, 15, 16, 17, 18, 19]","array_output":[10,11,12,13,14,15,16,17,18,19],"cells_accessed":[[0,0]],"input_python_std_out":"","success":true,"formatted_code":"result = []\\nrepeat = int(c(0, 0))\\nfor x in range(0, repeat):\\n    result.append(x + repeat)\\nresult\\n"}`,
  });
  await updateCellAndDCells({ starting_cells: [cell_0_1], sheetController: sc });

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

  mockPythonOutput({
    'result = []\nrepeat = int(c(0,0))\nfor x in range(0, repeat):\n  result.append(x + repeat)\nresult': `{"output_value":"[5, 6, 7, 8, 9]","array_output":[5,6,7,8,9],"cells_accessed":[[0,0]],"input_python_std_out":"","success":true,"formatted_code":"result = []\\nrepeat = int(c(0, 0))\\nfor x in range(0, repeat):\\n    result.append(x + repeat)\\nresult\\n"}`,
  });
  await updateCellAndDCells({ starting_cells: [cell_0_0_update], sheetController: sc });

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
  const cell_1_2_dependent = {
    x: 1,
    y: 2,
    value: '10',
    type: 'PYTHON',
    python_code: `c(0,2) + 100`,
  } as Cell;

  mockPythonOutput({
    'c(0,2) + 100': `{"cells_accessed":[[0,2]],"input_python_std_out":"","success":false,"input_python_stack_trace":"TypeError on line 1: unsupported operand type(s) for +: 'NoneType' and 'int'","formatted_code":"c(0,2) + 100"}`,
  });
  await updateCellAndDCells({ starting_cells: [cell_1_2_dependent], sheetController: sc });

  const cell_0_0 = {
    x: 0,
    y: 0,
    value: '',
    type: 'PYTHON',
    python_code: `[1,2,3,4,5,6,7,8,9,10]`,
  } as Cell;

  mockPythonOutput({
    '[1,2,3,4,5,6,7,8,9,10]': `{"output_value":"[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]","array_output":[1,2,3,4,5,6,7,8,9,10],"cells_accessed":[],"input_python_std_out":"","success":true,"formatted_code":"[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]\\n"}`,
    'c(0,2) + 100': `{"output_value":"103","cells_accessed":[[0,2]],"input_python_std_out":"","success":true,"formatted_code":"c(0, 2) + 100\\n"}`,
  });
  await updateCellAndDCells({ starting_cells: [cell_0_0], sheetController: sc });

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

  mockPythonOutput({
    '[1,2]': `{"output_value":"[1, 2]","array_output":[1,2],"cells_accessed":[],"input_python_std_out":"","success":true,"formatted_code":"[1, 2]\\n"}`,
    'c(0,2) + 100': `{"cells_accessed":[[0,2]],"input_python_std_out":"","success":false,"input_python_stack_trace":"TypeError on line 1: unsupported operand type(s) for +: 'NoneType' and 'int'","formatted_code":"c(0,2) + 100"}`,
  });
  await updateCellAndDCells({ starting_cells: [cell_0_0_update], sheetController: sc });

  // validate that the dependent cell is updated
  const after_code_run_cell_update = sc.sheet.grid.getNakedCells(1, 2, 1, 2);
  expect(after_code_run_cell_update.length).toBe(1);
  expect(after_code_run_cell_update[0]?.evaluation_result?.success).toBe(false);
  expect(after_code_run_cell_update[0]?.evaluation_result?.std_err).toBe(
    "TypeError on line 1: unsupported operand type(s) for +: 'NoneType' and 'int'"
  );
});

test('SheetController - test formula dependencies', async () => {
  const cell_0_0_dependent = {
    x: 0,
    y: 0,
    value: '',
    type: 'FORMULA',
    formula_code: 'A1+A2',
  } as Cell;

  await updateCellAndDCells({ starting_cells: [cell_0_0_dependent], sheetController: sc });

  let after_code_run_cells = sc.sheet.grid.getNakedCells(0, 0, 0, 0);
  expect(after_code_run_cells[0]?.value).toBe('0');

  const cell_0_1 = {
    x: 0,
    y: 1,
    value: '10',
    type: 'TEXT',
  } as Cell;

  await updateCellAndDCells({ starting_cells: [cell_0_1], sheetController: sc });

  after_code_run_cells = sc.sheet.grid.getNakedCells(0, 0, 0, 0);
  expect(after_code_run_cells[0]?.value).toBe('10');

  const cell_0_2 = {
    x: 0,
    y: 2,
    value: '20',
    type: 'TEXT',
  } as Cell;

  await updateCellAndDCells({ starting_cells: [cell_0_2], sheetController: sc });

  after_code_run_cells = sc.sheet.grid.getNakedCells(0, 0, 0, 0);
  expect(after_code_run_cells[0]?.value).toBe('30');
});

test('SheetController - test empty cell to be `null` in `array_output`', async () => {
  // Ensure that blank cells are `null`, e.g. (2,0) should be `null`
  // even when programtically getting cells
  //
  //    [ 0 ][ 1 ][ 2 ][ 3 ]
  // [0][foo][bar][   ][baz]
  //
  // https://github.com/quadratichq/quadratic/issues/472

  const cell_0_0 = {
    x: 0,
    y: 0,
    value: 'foo',
    type: 'TEXT',
    last_modified: '2023-01-19T19:12:21.745Z',
  } as Cell;

  const cell_1_0 = {
    x: 1,
    y: 0,
    value: 'bar',
    type: 'TEXT',
    last_modified: '2023-01-19T19:12:21.745Z',
  } as Cell;

  const cell_3_0 = {
    x: 3,
    y: 0,
    value: 'baz',
    type: 'TEXT',
    last_modified: '2023-01-19T19:12:21.745Z',
  } as Cell;

  const cell_0_1 = {
    x: 0,
    y: 1,
    value: '',
    type: 'PYTHON',
    python_code: 'val=cells((0,0), (3,0))\nval',
    last_modified: '2023-01-19T19:12:21.745Z',
  } as Cell;

  mockPythonOutput({
    'val=cells((0,0), (3,0))\nval': `{"output_value":"     0    1    2    3\\n0  foo  bar  NaN  baz","array_output":[["foo","bar",null,"baz"]],"cells_accessed":[[0,0],[1,0],[2,0],[3,0]],"input_python_std_out":"","success":true,"formatted_code":"val = cells((0, 0), (3, 0))\\nval\\n"}`,
  });
  await updateCellAndDCells({
    starting_cells: [cell_0_0, cell_1_0, cell_3_0, cell_0_1],
    sheetController: sc,
  });

  const result = sc.sheet.grid.getNakedCells(0, 1, 3, 1);
  expect(result[0]?.value).toBe('foo');
  expect(result[0]?.evaluation_result?.array_output).toStrictEqual([['foo', 'bar', null, 'baz']]);
  expect(result[1]?.value).toBe('bar');
  expect(result[1]?.type).toBe('COMPUTED');
  expect(result[2]?.value).toBe('baz');
  expect(result[2]?.type).toBe('COMPUTED');
});
