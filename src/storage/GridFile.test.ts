import { validateFile } from './GridFile';

const v1File = {
  version: '1.0',
  cells: [],
  columns: [],
  rows: [],
  borders: [],
  cell_dependency: 'foo',
  formats: [{ x: 1, y: 1 }],
  render_dependecy: [],
};

describe('validateFile()', () => {
  // TODO test the round trip of import to export to import

  test('Returns `null` for invalid JSON', () => {
    expect(validateFile({})).toStrictEqual(null);
    expect(validateFile({ foo: 'bar' })).toStrictEqual(null);
    expect(validateFile({ version: '1.0', cells: [], columns: [], rows: [] })).toStrictEqual(null);
  });

  test('Slightly invalid v1 files are fixed and upgraded', () => {
    expect(
      validateFile({
        ...v1File,
        version: 1,
      })
    ).not.toBe(null);
    expect(
      validateFile({
        ...v1File,
        cell_dependency: undefined,
      })
    ).not.toBe(null);
  });

  test('Upgrades a valid file from v1 to v1.1', () => {
    const result = validateFile(v1File);
    expect(result).toHaveProperty('version', '1.1');
    expect(result).toHaveProperty('modified');
    expect(result).toHaveProperty('created');
    expect(result).toHaveProperty('id');
    expect(result).toHaveProperty('filename');
  });

  test('Returns the file when it matches the most recent schema', () => {
    const v1_1File = {
      version: '1.1',
      cells: [],
      columns: [],
      rows: [],
      borders: [],
      formats: [{ x: 1, y: 1 }],
      render_dependecy: [],
      cell_dependency: 'foo',
      modified: 123,
      created: 123,
      id: '123e4567-e89b-12d3-a456-426614174000',
      filename: 'foo',
    };
    expect(validateFile(v1_1File)).toStrictEqual(v1_1File);
  });
});
