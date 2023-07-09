import { SheetController } from '../sheetController';
import { Cell } from '../../../schemas';
import { updateCellAndDCells } from '../../actions/updateCellAndDCells';
import { GetCellsDBSetSheet } from '../../sheet/Cells/GetCellsDB';

jest.mock('../../../web-workers/pythonWebWorker/PythonWebWorker');

const sc = new SheetController();
GetCellsDBSetSheet(sc.sheet);

test('SheetController - cell error', async () => {
  const cell = {
    x: 54,
    y: 54,
    value: '',
    type: 'PYTHON',
    python_code: 'asdf',
    last_modified: '2023-01-19T19:12:21.745Z',
  } as Cell;

  await updateCellAndDCells({ starting_cells: [cell], sheetController: sc });

  const cell_after = sc.sheet.grid.getCell(54, 54);

  expect(cell_after?.value).toBe('');
  expect(cell_after?.python_code).toBe('asdf');
  expect(cell_after?.evaluation_result?.success).toBe(false);
  expect(cell_after?.evaluation_result?.std_out).toBe('');
  expect(cell_after?.evaluation_result?.std_err).toBe("NameError on line 1: name 'asdf' is not defined");
  expect(cell_after?.last_modified).toBeDefined();
  expect(cell_after?.type).toBe('PYTHON');
});

test('SheetController - cell error prev array output', async () => {
  const sc = new SheetController();
  GetCellsDBSetSheet(sc.sheet);

  const cell_arr = {
    x: 54,
    y: 54,
    value: '',
    type: 'PYTHON',
    python_code: '[1, 2, 3]',
    last_modified: '2023-01-19T19:12:21.745Z',
  } as Cell;

  await updateCellAndDCells({ starting_cells: [cell_arr], sheetController: sc });

  const cell = {
    x: 54,
    y: 54,
    value: '',
    type: 'PYTHON',
    python_code: 'asdf',
    last_modified: '2023-01-19T19:12:21.745Z',
  } as Cell;

  await updateCellAndDCells({ starting_cells: [cell], sheetController: sc });

  const cell_after = sc.sheet.grid.getCell(54, 54);

  expect(cell_after?.value).toBe('');
  expect(cell_after?.python_code).toBe('asdf');
  expect(cell_after?.evaluation_result?.success).toBe(false);
  expect(cell_after?.evaluation_result?.std_out).toBe('');
  expect(cell_after?.evaluation_result?.std_err).toBe("NameError on line 1: name 'asdf' is not defined");
  expect(cell_after?.last_modified).toBeDefined();
  expect(cell_after?.type).toBe('PYTHON');
});
