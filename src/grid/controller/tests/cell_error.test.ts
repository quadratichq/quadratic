export {};

// import { pixiAppEvents } from '../../../gridGL/pixiApp/PixiAppEvents';
// import { Cell } from '../../../schemas';
// import { mockPixiApp } from '../../../setupPixiTests';
// import { webWorkers } from '../../../web-workers/webWorkers';
// import { updateCellAndDCells } from '../../actions/updateCellAndDCells';
// import { SheetController } from '../sheetController';
// import { mockPythonOutput } from './mockPythonOutput';

// jest.mock('../../../web-workers/pythonWebWorker/PythonWebWorker');

// const sc: SheetController = new SheetController();
// beforeAll(async () => {
//   pixiAppEvents.app = mockPixiApp();
//   pixiAppEvents.app.sheet_controller = sc;
//   webWorkers.init(pixiAppEvents.app);
// });

// beforeEach(() => {
//   sc.clear();
//   sc.sheet.clear();
// });

// test('SheetController - cell error', async () => {
//   const cell = {
//     x: 54,
//     y: 54,
//     value: '',
//     type: 'PYTHON',
//     python_code: 'asdf',
//     last_modified: '2023-01-19T19:12:21.745Z',
//   } as Cell;

//   mockPythonOutput({
//     asdf: `{"cells_accessed":[],"input_python_std_out":"","success":false,"input_python_stack_trace":"NameError on line 1: name 'asdf' is not defined","formatted_code":"asdf"}`,
//   });
//   await updateCellAndDCells({ starting_cells: [cell], sheetController: sc });

//   const cell_after = sc.sheet.grid.getCell(54, 54);

//   expect(cell_after?.value).toBe('');
//   expect(cell_after?.python_code).toBe('asdf');
//   expect(cell_after?.evaluation_result?.success).toBe(false);
//   expect(cell_after?.evaluation_result?.std_out).toBe('');
//   expect(cell_after?.evaluation_result?.std_err).toBe("NameError on line 1: name 'asdf' is not defined");
//   expect(cell_after?.last_modified).toBeDefined();
//   expect(cell_after?.type).toBe('PYTHON');
// });

// test('SheetController - cell error prev array output', async () => {
//   const cell_arr = {
//     x: 54,
//     y: 54,
//     value: '',
//     type: 'PYTHON',
//     python_code: '[1, 2, 3]',
//     last_modified: '2023-01-19T19:12:21.745Z',
//   } as Cell;

//   mockPythonOutput({
//     '[1, 2, 3]': `{"output_value":"[1, 2, 3]","array_output":[1,2,3],"cells_accessed":[],"input_python_std_out":"","success":true,"formatted_code":"[1, 2, 3]\\n"}`,
//   });
//   await updateCellAndDCells({ starting_cells: [cell_arr], sheetController: sc });

//   const cell = {
//     x: 54,
//     y: 54,
//     value: '',
//     type: 'PYTHON',
//     python_code: 'asdf',
//     last_modified: '2023-01-19T19:12:21.745Z',
//   } as Cell;

//   mockPythonOutput({
//     asdf: `{"cells_accessed":[],"input_python_std_out":"","success":false,"input_python_stack_trace":"NameError on line 1: name 'asdf' is not defined","formatted_code":"asdf"}`,
//   });
//   await updateCellAndDCells({ starting_cells: [cell], sheetController: sc });

//   const cell_after = sc.sheet.grid.getCell(54, 54);

//   expect(cell_after?.value).toBe('');
//   expect(cell_after?.python_code).toBe('asdf');
//   expect(cell_after?.evaluation_result?.success).toBe(false);
//   expect(cell_after?.evaluation_result?.std_out).toBe('');
//   expect(cell_after?.evaluation_result?.std_err).toBe("NameError on line 1: name 'asdf' is not defined");
//   expect(cell_after?.last_modified).toBeDefined();
//   expect(cell_after?.type).toBe('PYTHON');
// });
