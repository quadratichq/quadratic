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
    let v1FileSansVersion = { ...v1File };
    // @ts-expect-error
    delete v1FileSansVersion.version;
    expect(validateFile(v1FileSansVersion)).not.toBe(null);
    expect(
      validateFile({
        ...v1File,
        cell_dependency: undefined,
      })
    ).not.toBe(null);

    const result = validateFile({
      ...v1File,
      borders: [
        { x: 0, y: 0, horizontal: { type: 0 }, vertical: { type: 0 } },
        { x: 1, y: 1, horizontal: { type: 1 } },
        { x: 2, y: 2, horizontal: { type: 2 } },
        { x: 3, y: 3, horizontal: { type: 3 } },
        { x: 4, y: 4, horizontal: { type: 4 } },
        { x: 5, y: 5, horizontal: { type: 5 } },
        { x: 6, y: 6, horizontal: {} },
      ],
    });

    expect(result).toHaveProperty('borders[0].horizontal.type', 'line1');
    expect(result).toHaveProperty('borders[0].vertical.type', 'line1');
    expect(result).toHaveProperty('borders[1].horizontal.type', 'line2');
    expect(result).toHaveProperty('borders[2].horizontal.type', 'line3');
    expect(result).toHaveProperty('borders[3].horizontal.type', 'dotted');
    expect(result).toHaveProperty('borders[4].horizontal.type', 'dashed');
    expect(result).toHaveProperty('borders[5].horizontal.type', 'double');
    expect(result).toHaveProperty('borders[6].horizontal', {});
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
