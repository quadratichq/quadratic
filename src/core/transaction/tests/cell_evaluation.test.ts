import { SheetController } from '../sheetController';
import { Cell } from '../../gridDB/gridTypes';
import { setupPython } from '../../computations/python/loadPython';
import { updateCellAndDCells } from '../../actions/updateCellAndDCells';

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

  await updateCellAndDCells(cell, sc, undefined, pyodide);

  const cell_after = sc.sheet.grid.getCell(54, 54);

  expect(cell_after?.value).toBe('world');
  expect(cell_after?.python_code).toBe("print('hello')\n'world'\n");
  expect(cell_after?.python_output).toBe('hello\n');
  expect(cell_after?.last_modified).toBeDefined();
  expect(cell_after?.type).toBe('PYTHON');
});
