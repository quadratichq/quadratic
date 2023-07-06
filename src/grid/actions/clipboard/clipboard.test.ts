import { SheetController } from '../../controller/sheetController';
import { Cell } from '../../../schemas';
import { generateClipboardStrings } from './clipboard';
import { GetCellsDBSetSheet } from '../../sheet/Cells/GetCellsDB';
import { Sheet } from '../../sheet/Sheet';

jest.mock('../../../web-workers/pythonWebWorker/PythonWebWorker');

const createCell = (pos: [number, number], value: string): Cell => {
  return {
    x: pos[0],
    y: pos[1],
    value,
    type: 'TEXT',
  };
};

// Setup Pyodide before tests
const sc = new SheetController();
beforeAll(async () => {
  GetCellsDBSetSheet(sc.sheet);
});

test('Clipboard - copy data', () => {
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

  sc.execute_statement({
    type: 'SET_CELL',
    data: {
      position: [0, 1],
      value: createCell([0, 1], '3'),
    },
  });

  sc.execute_statement({
    type: 'SET_CELL',
    data: {
      position: [1, 1],
      value: createCell([1, 1], '4'),
    },
  });

  sc.end_transaction();

  const { plainTextClipboardString, htmlClipboardString, quadraticClipboardString } = generateClipboardStrings(
    sc,
    { x: 0, y: 0 },
    { x: 1, y: 1 }
  );

  expect(plainTextClipboardString).toBe('Hello\tWorld.\n3\t4');
  expect(htmlClipboardString).toBe(
    '<table><tbody><tr><td>Hello</td><td>World.</td></tr><tr><td>3</td><td>4</td></tr></tbody></table>'
  );
  expect(quadraticClipboardString).toBeDefined();
});

test('Clipboard - blank data', () => {
  sc.clear();
  sc.sheet = new Sheet();

  const { plainTextClipboardString, htmlClipboardString, quadraticClipboardString } = generateClipboardStrings(
    sc,
    { x: 0, y: 0 },
    { x: 4, y: 4 }
  );

  expect(plainTextClipboardString).toBe('\t\t\t\t\n\t\t\t\t\n\t\t\t\t\n\t\t\t\t\n\t\t\t\t');
  expect(htmlClipboardString).toBe(
    '<table><tbody><tr><td></td><td></td><td></td><td></td><td></td></tr><tr><td></td><td></td><td></td><td></td><td></td></tr><tr><td></td><td></td><td></td><td></td><td></td></tr><tr><td></td><td></td><td></td><td></td><td></td></tr><tr><td></td><td></td><td></td><td></td><td></td></tr></tbody></table>'
  );
  expect(quadraticClipboardString).toBeDefined();
});
