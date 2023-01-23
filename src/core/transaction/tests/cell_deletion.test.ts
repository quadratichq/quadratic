import { SheetController } from '../sheetController';
import { Cell } from '../../gridDB/gridTypes';
import { setupPython } from '../../computations/python/loadPython';
import { updateCellAndDCells } from '../../actions/updateCellAndDCells';
import { GetCellsDBSetSheet } from '../../gridDB/Cells/GetCellsDB';

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

  await updateCellAndDCells({ starting_cell: cell_0_0, sheetController: sc, pyodide });
  await updateCellAndDCells({ starting_cell: cell_0_1, sheetController: sc, pyodide });

  const cell_after = sc.sheet.grid.getCell(0, 1);
  expect(cell_after?.value).toBe('20');

  // test value update
  const cell_0_0_update = {
    x: 0,
    y: 0,
    value: '20',
    type: 'TEXT',
  } as Cell;

  await updateCellAndDCells({ starting_cell: cell_0_0_update, sheetController: sc, pyodide });

  const cell_after_update = sc.sheet.grid.getCell(0, 1);
  expect(cell_after_update?.value).toBe('40');

  // test deleting cell 0,0 update
  sc.predefined_transaction([
    {
      type: 'SET_CELL',
      data: {
        position: [0, 0],
        value: undefined,
      },
    },
  ]);

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

  await updateCellAndDCells({ starting_cell: cell_0_0, sheetController: sc, pyodide });
  await updateCellAndDCells({ starting_cell: cell_1_0, sheetController: sc, pyodide });
  await updateCellAndDCells({ starting_cell: cell_1_1, sheetController: sc, pyodide });
  await updateCellAndDCells({ starting_cell: cell_1_2, sheetController: sc, pyodide });
  await updateCellAndDCells({ starting_cell: cell_1_3, sheetController: sc, pyodide });

  const cell_after_1_0 = sc.sheet.grid.getCell(1, 0);
  expect(cell_after_1_0?.value).toBe('4');
  const cell_after_1_1 = sc.sheet.grid.getCell(1, 1);
  expect(cell_after_1_1?.value).toBe('8');
  const cell_after_1_2 = sc.sheet.grid.getCell(1, 2);
  expect(cell_after_1_2?.value).toBe('12');
  const cell_after_1_3 = sc.sheet.grid.getCell(1, 3);
  expect(cell_after_1_3?.value).toBe('16');

  // try deleting cell bulk cells
  sc.predefined_transaction([
    {
      type: 'SET_CELL',
      data: {
        position: [0, 0],
        value: undefined,
      },
    },
    {
      type: 'SET_CELL',
      data: {
        position: [1, 0],
        value: undefined,
      },
    },
    {
      type: 'SET_CELL',
      data: {
        position: [2, 0],
        value: undefined,
      },
    },
    {
      type: 'SET_CELL',
      data: {
        position: [3, 0],
        value: undefined,
      },
    },
  ]);

  // validate that all cells are now None after deletion
  const cells_after_delete_dependency = sc.sheet.grid.getNakedCells(1, 0, 1, 3);
  cells_after_delete_dependency.forEach((cell) => {
    expect(cell.value).toBe('');
  });
});
