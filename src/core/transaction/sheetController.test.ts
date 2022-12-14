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
