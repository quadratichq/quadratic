import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { describe, expect, test } from 'vitest';
import { GridFileSchema } from '.';
import { GridFileV1_0 } from './GridFileV1_0';
import { GridFileV1_1, upgradeV1_0toV1_1 } from './GridFileV1_1';
import { GridFileV1_2, upgradeV1_1toV1_2 } from './GridFileV1_2';
import { GridFileV1_3, upgradeV1_2toV1_3 } from './GridFileV1_3';
import { GridFileV1_4 } from './GridFileV1_4';
import { validateAndUpgradeLegacyGridFile } from './validateAndUpgradeLegacyGridFile';

const v = (input: any) => validateAndUpgradeLegacyGridFile(input, false);
const LATEST_VERSION = GridFileSchema.shape.version.value;
const EXAMPLES_DIR = path.join(__dirname, '../../public/examples/');
const exampleGridFiles: string[] = fs
  .readdirSync(EXAMPLES_DIR)
  .filter((name) => name.includes('.grid'))
  .map((name) => fs.readFileSync(path.join(EXAMPLES_DIR, name)).toString());

/**
 * Sample file: 1.0
 */
const v1_0File: GridFileV1_0 = {
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
  cell_dependency: '[]',
  formats: [{ x: 1, y: 1 }],
  render_dependency: [],
};

/**
 * Sample file: 1.1
 */
const v1_1File: GridFileV1_1 = {
  version: '1.1',
  cells: [
    // TODO test to allow `any` for `array_output`
    {
      x: 0,
      y: 0,
      type: 'PYTHON',
      value: '1,2,3',
      last_modified: '2023-06-27T16:54:40.619Z',
      evaluation_result: {
        success: true,
        std_out: '',
        output_value: '[[[1, 2, 3]]]',
        cells_accessed: [],
        array_output: [[[1, 2, 3]]],
        formatted_code: '[[[1, 2, 3]]]\n',
        error_span: null,
      },
      python_code: '[[[1,2,3]]]',
      array_cells: [[0, 0]],
    },
  ],
  columns: [],
  rows: [],
  borders: [],
  cell_dependency: '[]',
  formats: [],
  render_dependency: [],
  id: randomUUID(),
  created: 1,
  filename: '1',
  modified: 1,
};

/**
 * Sample file: 1.2
 */
const v1_2File: GridFileV1_2 = {
  version: '1.2',
  cells: [],
  columns: [],
  rows: [],
  borders: [{ x: 0, y: 0, horizontal: { type: 'line1' } }],
  formats: [{ x: 1, y: 1 }],
  cell_dependency: '[]',
  modified: 123,
  created: 123,
  id: '123e4567-e89b-12d3-a456-426614174000',
  filename: 'foo',
};

/**
 * Sample file: 1.3
 */
const v1_3File: GridFileV1_3 = {
  version: '1.3',
  cells: [],
  columns: [],
  rows: [],
  borders: [{ x: 0, y: 0, horizontal: { type: 'line1' } }],
  formats: [{ x: 1, y: 1 }],
  cell_dependency: '[]',
};

/**
 * Sample file: 1.4
 */
const v1_4File: GridFileV1_4 = {
  version: '1.4',
  cell_dependency: 'foo',
  sheets: [
    {
      id: '123e4567-e89b-12d3-a456-426614174000',
      name: 'foo',
      order: '1',
      cells: [],
      columns: [],
      rows: [],
      borders: [{ x: 0, y: 0, horizontal: { type: 'line1' } }],
      formats: [{ x: 1, y: 1 }],
    },
  ],
};

describe('upgrade files from one specific version to another', () => {
  test('upgrade from v1_0 -> v1_1', () => {
    const result = upgradeV1_0toV1_1(v1_0File);
    expect(result).not.toBeNull();
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
  test('upgrade from v1_1 -> v1_2', () => {
    const result = upgradeV1_1toV1_2(v1_1File);
    expect(result).not.toBeNull();
    expect(result).toHaveProperty('version', '1.2');
    expect(result).toHaveProperty('modified');
    expect(result).toHaveProperty('created');
    expect(result).toHaveProperty('id');
    expect(result).toHaveProperty('filename');
    expect(result).not.toHaveProperty('render_dependency');
  });
  test('upgrade from v1_2 -> v1_3', () => {
    const result = upgradeV1_2toV1_3(v1_2File);
    expect(result).not.toBeNull();
    expect(result).toHaveProperty('version', '1.3');
    expect(result).not.toHaveProperty('filename');
    expect(result).not.toHaveProperty('id');
    expect(result).not.toHaveProperty('modified');
    expect(result).not.toHaveProperty('created');
  });
});

describe('invalid input fails validation and upgrade', () => {
  test('returns `null` for non-string inputs', () => {
    expect(v(123)).toStrictEqual(null);
    expect(v({})).toStrictEqual(null);
    expect(v([])).toStrictEqual(null);
    expect(v(null)).toStrictEqual(null);
    expect(v(undefined)).toStrictEqual(null);
    expect(v(() => {})).toStrictEqual(null);
  });
  test('returns `null` for invalid JSON', () => {
    // expect(v('{}')).toStrictEqual(null);
    expect(v(`{ foo: 'bar' }`)).toStrictEqual(null);
    expect(v(`{ version: '1.0', cells: [], columns: [], rows: [] }`)).toStrictEqual(null);
  });
});

describe('valid input passes validation and upgrades file to the most recent', () => {
  test('fixes one-off abnormalities in pre-v1_0 files', () => {
    expect(
      v(
        JSON.stringify({
          ...v1_0File,
          version: 1,
        })
      )
    ).not.toBe(null);

    const { version, ...v1_0FileSansVersion } = v1_0File;
    expect(v(JSON.stringify(v1_0FileSansVersion))).not.toBe(null);

    const { cell_dependency, ...v1_0FileSansCellDependency } = v1_0File;
    expect(v(JSON.stringify(v1_0FileSansCellDependency))).not.toBe(null);
  });

  test('validates and upgrades example files (as necessary)', () => {
    exampleGridFiles.forEach((gridFile) => {
      expect(v(gridFile)).not.toBe(null);
    });
  });

  test('validates and upgrades a file from v1.0 the the most recent', () => {
    const result = v(JSON.stringify(v1_0File));
    expect(result).not.toBeNull();
    expect(result).toHaveProperty('version', LATEST_VERSION);
  });

  test('validates and upgrades a file from v1.1 to the most recent', () => {
    const result = v(JSON.stringify(v1_1File));
    expect(result).not.toBeNull();
    expect(result).toHaveProperty('version', LATEST_VERSION);
  });

  test('validates and upgrades a file from v1.2 the most recent', () => {
    const result = v(JSON.stringify(v1_2File));
    expect(result).not.toBeNull();
    expect(result).toHaveProperty('version', LATEST_VERSION);
  });

  test('validates and upgrades a file from v1.3 the most recent', () => {
    const result = v(JSON.stringify(v1_3File));
    expect(result).not.toBeNull();
    expect(result).toHaveProperty('version', LATEST_VERSION);
  });

  test('returns file matching the most recent', () => {
    const result = v(JSON.stringify(v1_4File));
    expect(result).toStrictEqual(v1_4File);
  });
});
