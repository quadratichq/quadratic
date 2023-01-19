import { SheetController } from './sheetController';
import { Cell } from '../gridDB/gridTypes';

const createCell = (pos: [number, number], value: string): Cell => {
  return {
    x: pos[0],
    y: pos[1],
    value,
    type: 'TEXT',
  };
};

test('SheetController', () => {
  const sc = new SheetController();

  sc.start_transaction();

  sc.execute_statement({
    type: 'SET_CELL',
    data: {
      position: [0, 0],
      value: createCell([0, 0], 'Hello'),
    },
  });

  sc.execute_statement({
    type: 'SET_CELL',
    data: {
      position: [1, 0],
      value: createCell([1, 0], 'World.'),
    },
  });

  sc.end_transaction();

  expect(sc.sheet.grid.getCell(0, 0)?.value).toBe('Hello');
  expect(sc.sheet.grid.getCell(1, 0)?.value).toBe('World.');

  expect(sc.has_redo()).toBeFalsy();
  expect(sc.has_undo()).toBeTruthy();

  sc.undo();

  expect(sc.has_redo()).toBeTruthy();
  expect(sc.has_undo()).toBeFalsy();

  expect(sc.sheet.grid.getCell(0, 0)).toBeUndefined();
  expect(sc.sheet.grid.getCell(0, 0)).toBeUndefined();

  sc.redo();

  expect(sc.sheet.grid.getCell(0, 0)?.value).toBe('Hello');
  expect(sc.sheet.grid.getCell(1, 0)?.value).toBe('World.');

  expect(sc.has_redo()).toBeFalsy();
  expect(sc.has_undo()).toBeTruthy();

  sc.undo();

  expect(sc.has_redo()).toBeTruthy();
  expect(sc.has_undo()).toBeFalsy();

  expect(sc.sheet.grid.getCell(0, 0)).toBeUndefined();
  expect(sc.sheet.grid.getCell(0, 0)).toBeUndefined();

  sc.redo();

  expect(sc.sheet.grid.getCell(0, 0)?.value).toBe('Hello');
  expect(sc.sheet.grid.getCell(1, 0)?.value).toBe('World.');

  expect(sc.has_redo()).toBeFalsy();
  expect(sc.has_undo()).toBeTruthy();
});

test('SheetController - code is saved from undo to redo', () => {
  const sc = new SheetController();

  sc.start_transaction();

  const cell = {
    x: 14,
    y: 34,
    value: 'hello',
    type: 'PYTHON',
    python_code: "print('hello')\n'hello'",
    python_output: 'hello',
    last_modified: '2023-01-19T19:12:21.745Z',
  } as Cell;

  sc.execute_statement({
    type: 'SET_CELL',
    data: {
      position: [14, 34],
      value: cell,
    },
  });

  sc.end_transaction();

  expect(sc.sheet.grid.getCell(14, 34)?.value).toBe('hello');
  expect(sc.sheet.grid.getCell(14, 34)?.python_code).toBe("print('hello')\n'hello'");
  expect(sc.sheet.grid.getCell(14, 34)?.python_output).toBe('hello');
  expect(sc.sheet.grid.getCell(14, 34)?.last_modified).toBe('2023-01-19T19:12:21.745Z');
  expect(sc.sheet.grid.getCell(14, 34)?.type).toBe('PYTHON');

  sc.undo();

  expect(sc.sheet.grid.getCell(14, 34)).toBeUndefined();

  sc.redo();

  expect(sc.sheet.grid.getCell(14, 34)?.value).toBe('hello');
  expect(sc.sheet.grid.getCell(14, 34)?.python_code).toBe("print('hello')\n'hello'");
  expect(sc.sheet.grid.getCell(14, 34)?.python_output).toBe('hello');
  expect(sc.sheet.grid.getCell(14, 34)?.last_modified).toBe('2023-01-19T19:12:21.745Z');
  expect(sc.sheet.grid.getCell(14, 34)?.type).toBe('PYTHON');
});
