import { beforeAll, test } from 'vitest';

export {};
// const createCell = (pos: [number, number], value: string): Cell => {
//   return {
//     x: pos[0],
//     y: pos[1],
//     value,
//     type: 'TEXT',
//   };
// };

beforeAll(() => {
  // pixiAppEvents.app = mockPixiApp();
});

test('SheetController', () => {
  // const sc = new SheetController();
  // sc.start_transaction();
  // sc.execute_statement({
  //   type: 'SET_CELLS',
  //   data: [createCell([0, 0], 'Hello')],
  // });
  // sc.execute_statement({
  //   type: 'SET_CELLS',
  //   data: [createCell([1, 0], 'World.')],
  // });
  // sc.end_transaction();
  // expect(sc.sheet.grid.getCell(0, 0)?.value).toBe('Hello');
  // expect(sc.sheet.grid.getCell(1, 0)?.value).toBe('World.');
  // expect(sc.has_redo()).toBeFalsy();
  // expect(sc.has_undo()).toBeTruthy();
  // sc.undo();
  // expect(sc.has_redo()).toBeTruthy();
  // expect(sc.has_undo()).toBeFalsy();
  // expect(sc.sheet.grid.getCell(0, 0)).toBeUndefined();
  // expect(sc.sheet.grid.getCell(0, 0)).toBeUndefined();
  // sc.redo();
  // expect(sc.sheet.grid.getCell(0, 0)?.value).toBe('Hello');
  // expect(sc.sheet.grid.getCell(1, 0)?.value).toBe('World.');
  // expect(sc.has_redo()).toBeFalsy();
  // expect(sc.has_undo()).toBeTruthy();
  // sc.undo();
  // expect(sc.has_redo()).toBeTruthy();
  // expect(sc.has_undo()).toBeFalsy();
  // expect(sc.sheet.grid.getCell(0, 0)).toBeUndefined();
  // expect(sc.sheet.grid.getCell(0, 0)).toBeUndefined();
  // sc.redo();
  // expect(sc.sheet.grid.getCell(0, 0)?.value).toBe('Hello');
  // expect(sc.sheet.grid.getCell(1, 0)?.value).toBe('World.');
  // expect(sc.has_redo()).toBeFalsy();
  // expect(sc.has_undo()).toBeTruthy();
});

test('SheetController - code is saved from undo to redo', () => {
  // const sc = new SheetController();
  // sc.start_transaction();
  // const cell = {
  //   x: 14,
  //   y: 34,
  //   value: 'hello',
  //   type: 'PYTHON',
  //   python_code: "print('hello')\n'hello'",
  //   evaluation_result: { std_out: 'hello' },
  //   last_modified: '2023-01-19T19:12:21.745Z',
  // } as Cell;
  // sc.execute_statement({
  //   type: 'SET_CELLS',
  //   data: [cell],
  // });
  // sc.end_transaction();
  // expect(sc.sheet.grid.getCell(14, 34)?.value).toBe('hello');
  // expect(sc.sheet.grid.getCell(14, 34)?.python_code).toBe("print('hello')\n'hello'");
  // expect(sc.sheet.grid.getCell(14, 34)?.evaluation_result?.std_out).toBe('hello');
  // expect(sc.sheet.grid.getCell(14, 34)?.last_modified).toBe('2023-01-19T19:12:21.745Z');
  // expect(sc.sheet.grid.getCell(14, 34)?.type).toBe('PYTHON');
  // sc.undo();
  // expect(sc.sheet.grid.getCell(14, 34)).toBeUndefined();
  // sc.redo();
  // expect(sc.sheet.grid.getCell(14, 34)?.value).toBe('hello');
  // expect(sc.sheet.grid.getCell(14, 34)?.python_code).toBe("print('hello')\n'hello'");
  // expect(sc.sheet.grid.getCell(14, 34)?.evaluation_result?.std_out).toBe('hello');
  // expect(sc.sheet.grid.getCell(14, 34)?.last_modified).toBe('2023-01-19T19:12:21.745Z');
  // expect(sc.sheet.grid.getCell(14, 34)?.type).toBe('PYTHON');
});

test('SheetController - multiple values set to cell in same transaction', () => {
  // const sc = new SheetController();
  // sc.start_transaction();
  // const cell = {
  //   x: 0,
  //   y: 0,
  //   value: 'hello',
  //   type: 'TEXT',
  //   last_modified: '2023-01-19T19:12:21.745Z',
  // } as Cell;
  // sc.execute_statement({
  //   type: 'SET_CELLS',
  //   data: [cell],
  // });
  // sc.end_transaction();
  // const result_cell_1 = sc.sheet.grid.getCell(0, 0);
  // expect(result_cell_1?.value).toBe('hello');
  // expect(result_cell_1?.type).toBe('TEXT');
  // expect(result_cell_1?.python_code).toBeUndefined();
  // expect(result_cell_1?.evaluation_result).toBeUndefined();
  // expect(result_cell_1?.last_modified).toBe('2023-01-19T19:12:21.745Z');
  // sc.start_transaction();
  // sc.execute_statement({
  //   type: 'SET_CELLS',
  //   data: [{ x: 0, y: 0 }],
  // });
  // sc.execute_statement({
  //   type: 'SET_CELLS',
  //   data: [{ ...cell, value: 'hello2' }],
  // });
  // sc.end_transaction();
  // expect(sc.sheet.grid.getCell(0, 0)?.value).toBe('hello2');
  // sc.undo();
  // expect(sc.sheet.grid.getCell(0, 0)?.value).toBe('hello');
  // sc.undo();
  // expect(sc.sheet.grid.getCell(0, 0)).toBeUndefined();
  // sc.redo();
  // expect(sc.sheet.grid.getCell(0, 0)?.value).toBe('hello');
  // sc.redo();
  // expect(sc.sheet.grid.getCell(0, 0)?.value).toBe('hello2');
});
