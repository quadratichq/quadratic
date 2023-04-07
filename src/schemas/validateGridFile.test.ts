import fs from 'fs';
import path from 'path';
import { GridFiles } from '.';
import { GridFileV1 } from './GridFileV1';
import { GridFileV1_1 } from './GridFileV1_1';
import { validateGridFile } from './validateGridFile';
const v = validateGridFile;
const EXAMPLES_DIR = path.join(__dirname, '../../public/examples/');
const exampleGridFiles: GridFiles[] = fs
  .readdirSync(EXAMPLES_DIR)
  .filter((name) => name.includes('.grid'))
  .map((name) => JSON.parse(fs.readFileSync(path.join(EXAMPLES_DIR, name)).toString()));

const v1File: GridFileV1 = {
  version: '1.0',
  cells: [],
  columns: [],
  rows: [],
  borders: [
    { x: 0, y: 0, horizontal: { type: 0 }, vertical: { type: 0 } },
    { x: 1, y: 1, horizontal: { type: 1 } },
    { x: 2, y: 2, horizontal: { type: 2 } },
    { x: 3, y: 3, horizontal: { type: 3 } },
    { x: 4, y: 4, horizontal: { type: 4 } },
    { x: 5, y: 5, horizontal: { type: 5 } },
    { x: 6, y: 6, horizontal: {} },
    { x: 7, y: 7 },
  ],
  cell_dependency: 'foo',
  formats: [{ x: 1, y: 1 }],
  render_dependency: [],
};

describe('validateFile()', () => {
  // TODO test the round trip of import to export to import

  test('Example files can be validate (and upgraded as needed)', () => {
    exampleGridFiles.forEach((gridFile) => {
      expect(v(gridFile)).not.toBe(null);
    });
  });

  test('Returns `null` for invalid JSON', () => {
    expect(v({})).toStrictEqual(null);
    expect(v({ foo: 'bar' })).toStrictEqual(null);
    expect(v({ version: '1.0', cells: [], columns: [], rows: [] })).toStrictEqual(null);
  });

  test('Fixes one-off abnormalities in pre-v1 files', () => {
    expect(
      v({
        ...v1File,
        version: 1,
      })
    ).not.toBe(null);

    const { version, ...v1FileSansVersion } = v1File;
    expect(v(v1FileSansVersion)).not.toBe(null);

    const { cell_dependency, ...v1FileSansCellDependency } = v1File;
    expect(v(v1FileSansCellDependency)).not.toBe(null);
  });

  test('Upgrades a valid file from v1 to v1.1', () => {
    const result = v(v1File);
    expect(result).toHaveProperty('version', '1.1');
    expect(result).toHaveProperty('modified');
    expect(result).toHaveProperty('created');
    expect(result).toHaveProperty('id');
    expect(result).toHaveProperty('filename');
    expect(result).toHaveProperty('borders[0].horizontal.type', 'line1');
    expect(result).toHaveProperty('borders[0].vertical.type', 'line1');
    expect(result).toHaveProperty('borders[1].horizontal.type', 'line2');
    expect(result).toHaveProperty('borders[2].horizontal.type', 'line3');
    expect(result).toHaveProperty('borders[3].horizontal.type', 'dotted');
    expect(result).toHaveProperty('borders[4].horizontal.type', 'dashed');
    expect(result).toHaveProperty('borders[5].horizontal.type', 'double');
    expect(result).toHaveProperty('borders[6].horizontal', {});
    expect(result).not.toHaveProperty('borders[7].horizontal');
  });

  test('Returns the file when it matches the most recent schema', () => {
    const v1_1File: GridFileV1_1 = {
      version: '1.1',
      cells: [],
      columns: [],
      rows: [],
      borders: [{ x: 0, y: 0, horizontal: { type: 'line1' } }],
      formats: [{ x: 1, y: 1 }],
      render_dependency: [],
      cell_dependency: 'foo',
      modified: 123,
      created: 123,
      id: '123e4567-e89b-12d3-a456-426614174000',
      filename: 'foo',
    };
    expect(v(v1_1File)).toStrictEqual(v1_1File);
  });
});
