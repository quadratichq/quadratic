import { Rectangle } from 'pixi.js';
import { CELL_HEIGHT, CELL_WIDTH } from '../../../constants/gridConstants';
import { Cell, CellFormat } from '../../../schemas';
import { GridOffsets } from '../GridOffsets';
import { GridSparse } from '../GridSparse';

describe('gridSparse', () => {
  const gridOffsets = new GridOffsets();

  it('creates an empty gridSparse', () => {
    const gridSparse = new GridSparse(gridOffsets);
    gridSparse.populate();
    expect(gridSparse.empty).toBe(true);
    expect(gridSparse.get(0, 0)).toBeUndefined();

    const { bounds, boundsWithData } = gridSparse.getBounds(new Rectangle(-1000, -2000, 2000, 4000));

    expect(boundsWithData).toBeUndefined();

    expect(bounds.left).toBe(-1000 / CELL_WIDTH);
    expect(bounds.top).toBe(-2000 / CELL_HEIGHT);

    // -1 b/c it starts at 0
    expect(bounds.right).toBe(1000 / CELL_WIDTH);
    expect(bounds.bottom).toBe(2000 / CELL_HEIGHT);
  });

  it('populates cells with 1 cell of data (positive)', () => {
    const gridSparse = new GridSparse(gridOffsets);
    gridSparse.populate([
      {
        x: 1,
        y: 2,
      } as Cell,
    ]);

    const { boundsWithData } = gridSparse.getBounds(new Rectangle(-1000, -2000, 2000, 4000));

    expect(boundsWithData).toBeDefined();
    expect(boundsWithData!.left).toBe(1);
    expect(boundsWithData!.right).toBe(1);
    expect(boundsWithData!.top).toBe(2);
    expect(boundsWithData!.bottom).toBe(2);
    expect(boundsWithData!.width).toBe(0);
    expect(boundsWithData!.height).toBe(0);

    expect(gridSparse.get(1, 2)).toBeDefined();
    expect(gridSparse.get(0, 0)).toBeUndefined();
    expect(gridSparse.getCell(1, 2)).toBeDefined();
    expect(gridSparse.getCell(0, 0)).toBeUndefined();
    expect(gridSparse.getFormat(1, 2)).toBeUndefined();
    expect(gridSparse.getFormat(0, 0)).toBeUndefined();
  });

  it('populates cells with 1 cell of data (negative)', () => {
    const gridSparse = new GridSparse(gridOffsets);
    gridSparse.populate([
      {
        x: -1,
        y: -2,
      } as Cell,
    ]);

    const { boundsWithData } = gridSparse.getBounds(new Rectangle(-1000, -2000, 2000, 4000));

    expect(boundsWithData).toBeDefined();
    expect(boundsWithData!.left).toBe(-1);
    expect(boundsWithData!.right).toBe(-1);
    expect(boundsWithData!.top).toBe(-2);
    expect(boundsWithData!.bottom).toBe(-2);
    expect(boundsWithData!.width).toBe(0);
    expect(boundsWithData!.height).toBe(0);

    expect(gridSparse.get(-1, -2)).toBeDefined();
    expect(gridSparse.get(0, 0)).toBeUndefined();
    expect(gridSparse.getCell(-1, -2)).toBeDefined();
    expect(gridSparse.getCell(0, 0)).toBeUndefined();
    expect(gridSparse.getFormat(-1, -2)).toBeUndefined();
    expect(gridSparse.getFormat(0, 0)).toBeUndefined();
  });

  it('populates cells with multiple cells of data', () => {
    const gridSparse = new GridSparse(gridOffsets);
    gridSparse.populate([
      {
        x: -1,
        y: -2,
      } as Cell,
      {
        x: 1,
        y: 2,
      } as Cell,
    ]);

    const { boundsWithData } = gridSparse.getBounds(new Rectangle(-1000, -2000, 2000, 4000));

    expect(boundsWithData).toBeDefined();
    expect(boundsWithData!.left).toBe(-1);
    expect(boundsWithData!.right).toBe(1);
    expect(boundsWithData!.top).toBe(-2);
    expect(boundsWithData!.bottom).toBe(2);

    expect(gridSparse.get(-1, -2)).toBeDefined();
    expect(gridSparse.get(1, 2)).toBeDefined();
    expect(gridSparse.get(0, 0)).toBeUndefined();
    expect(gridSparse.getCell(-1, -2)).toBeDefined();
    expect(gridSparse.getCell(1, 2)).toBeDefined();
    expect(gridSparse.getCell(0, 0)).toBeUndefined();
    expect(gridSparse.getFormat(-1, -2)).toBeUndefined();
    expect(gridSparse.getFormat(1, 2)).toBeUndefined();
    expect(gridSparse.getFormat(0, 0)).toBeUndefined();
  });

  it('populates cells with 1 cell of format data (positive)', () => {
    const gridSparse = new GridSparse(gridOffsets);
    gridSparse.populate(
      [],
      [
        {
          x: 1,
          y: 2,
        } as Cell,
      ]
    );

    const { boundsWithData } = gridSparse.getBounds(new Rectangle(-1000, -2000, 2000, 4000));

    expect(boundsWithData).toBeDefined();
    expect(boundsWithData!.left).toBe(1);
    expect(boundsWithData!.right).toBe(1);
    expect(boundsWithData!.top).toBe(2);
    expect(boundsWithData!.bottom).toBe(2);
    expect(boundsWithData!.width).toBe(0);
    expect(boundsWithData!.height).toBe(0);

    expect(gridSparse.get(1, 2)).toBeDefined();
    expect(gridSparse.get(0, 0)).toBeUndefined();
    expect(gridSparse.getCell(1, 2)).toBeUndefined();
    expect(gridSparse.getCell(0, 0)).toBeUndefined();
    expect(gridSparse.getFormat(1, 2)).toBeDefined();
    expect(gridSparse.getFormat(0, 0)).toBeUndefined();
  });

  it('populates cells with 1 cell of format data (negative)', () => {
    const gridSparse = new GridSparse(gridOffsets);
    gridSparse.populate(
      [],
      [
        {
          x: -1,
          y: -2,
        } as Cell,
      ]
    );

    const { boundsWithData } = gridSparse.getBounds(new Rectangle(-1000, -2000, 2000, 4000));

    expect(boundsWithData).toBeDefined();
    expect(boundsWithData!.left).toBe(-1);
    expect(boundsWithData!.right).toBe(-1);
    expect(boundsWithData!.top).toBe(-2);
    expect(boundsWithData!.bottom).toBe(-2);
    expect(boundsWithData!.width).toBe(0);
    expect(boundsWithData!.height).toBe(0);

    expect(gridSparse.get(-1, -2)).toBeDefined();
    expect(gridSparse.get(0, 0)).toBeUndefined();

    expect(gridSparse.getCell(-1, -2)).toBeUndefined();
    expect(gridSparse.getCell(0, 0)).toBeUndefined();
    expect(gridSparse.getFormat(-1, -2)).toBeDefined();
    expect(gridSparse.getFormat(0, 0)).toBeUndefined();
  });

  it('populates cells with multiple cells of format data', () => {
    const gridSparse = new GridSparse(gridOffsets);
    gridSparse.populate(
      [],
      [
        {
          x: -1,
          y: -2,
        } as Cell,
        {
          x: 1,
          y: 2,
        } as Cell,
      ]
    );

    const { boundsWithData } = gridSparse.getBounds(new Rectangle(-1000, -2000, 2000, 4000));

    expect(boundsWithData).toBeDefined();
    expect(boundsWithData!.left).toBe(-1);
    expect(boundsWithData!.right).toBe(1);
    expect(boundsWithData!.top).toBe(-2);
    expect(boundsWithData!.bottom).toBe(2);

    expect(gridSparse.get(-1, -2)).toBeDefined();
    expect(gridSparse.get(1, 2)).toBeDefined();
    expect(gridSparse.get(0, 0)).toBeUndefined();

    expect(gridSparse.getCell(1, 2)).toBeUndefined();
    expect(gridSparse.getCell(-1, -2)).toBeUndefined();
    expect(gridSparse.getCell(0, 0)).toBeUndefined();
    expect(gridSparse.getFormat(-1, -2)).toBeDefined();
    expect(gridSparse.getFormat(1, 2)).toBeDefined();
    expect(gridSparse.getFormat(0, 0)).toBeUndefined();
  });

  it('gets row min/max', () => {
    const gridSparse = new GridSparse(gridOffsets);
    gridSparse.populate([
      {
        x: 1,
        y: 2,
      } as Cell,
      {
        x: 5,
        y: 2,
      } as Cell,
      {
        x: -5,
        y: 2,
      } as Cell,
    ]);

    const minMax = gridSparse.getRowMinMax(2, false);
    expect(minMax?.min).toBe(-5);
    expect(minMax?.max).toBe(5);
  });

  it('gets columns min/max', () => {
    const gridSparse = new GridSparse(gridOffsets);
    gridSparse.populate([
      {
        x: 2,
        y: 1,
      } as Cell,
      {
        x: 2,
        y: 5,
      } as Cell,
      {
        x: 2,
        y: -5,
      } as Cell,
    ]);

    const minMax = gridSparse.getColumnMinMax(2, false);
    expect(minMax?.min).toBe(-5);
    expect(minMax?.max).toBe(5);
  });

  it('gets all cells', () => {
    const gridSparse = new GridSparse(gridOffsets);
    gridSparse.populate([
      {
        x: 2,
        y: 1,
      } as Cell,
      {
        x: 2,
        y: 5,
      } as Cell,
      {
        x: 2,
        y: -5,
      } as Cell,
    ]);
    const cells = gridSparse.getAllCells();
    expect(cells.length).toBe(3);
  });

  it('gets arrays', () => {
    const gridSparse = new GridSparse(gridOffsets);
    gridSparse.populate(
      [
        {
          x: 2,
          y: 1,
        } as Cell,
        {
          x: 2,
          y: 5,
        } as Cell,
        {
          x: 2,
          y: -5,
        } as Cell,
      ],
      [
        {
          x: 2,
          y: 1,
        } as CellFormat,
        {
          x: 2,
          y: 5,
        } as CellFormat,
      ]
    );
    const arrays = gridSparse.getArrays();
    expect(arrays.cells.length).toBe(3);
    expect(arrays.formats.length).toBe(2);
  });

  it('updates cells', () => {
    const gridSparse = new GridSparse(gridOffsets);
    gridSparse.populate([
      {
        x: 2,
        y: 1,
        value: '1',
      } as Cell,
      {
        x: 2,
        y: 5,
        value: '2',
      } as Cell,
      {
        x: 2,
        y: -5,
        value: '3',
      } as Cell,
    ]);
    gridSparse.updateCells([
      {
        x: 2,
        y: 1,
        value: '5',
      } as Cell,
      {
        x: 2,
        y: -5,
        value: '6',
      } as Cell,
      {
        x: -10,
        y: -11,
        value: '8',
      } as Cell,
    ]);
    expect(gridSparse.getCell(2, 1)?.value).toBe('5');
    expect(gridSparse.getCell(2, -5)?.value).toBe('6');
    expect(gridSparse.getCell(-10, -11)?.value).toBe('8');
    expect(gridSparse.getCell(2, 5)?.value).toBe('2');
  });

  it('updates formats', () => {
    const gridSparse = new GridSparse(gridOffsets);
    gridSparse.populate(
      [],
      [
        {
          x: 2,
          y: 1,
          fillColor: '1',
        } as CellFormat,
        {
          x: 2,
          y: 5,
          fillColor: '2',
        } as CellFormat,
        {
          x: 2,
          y: -5,
          fillColor: '3',
        } as CellFormat,
      ]
    );
    gridSparse.updateFormat([
      {
        x: 2,
        y: 1,
        fillColor: '5',
      } as CellFormat,
      {
        x: 2,
        y: -5,
        fillColor: '6',
      } as CellFormat,
      {
        x: -10,
        y: -11,
        fillColor: '8',
      } as CellFormat,
    ]);
    expect(gridSparse.getFormat(2, 1)?.fillColor).toBe('5');
    expect(gridSparse.getFormat(2, -5)?.fillColor).toBe('6');
    expect(gridSparse.getFormat(-10, -11)?.fillColor).toBe('8');
    expect(gridSparse.getFormat(2, 5)?.fillColor).toBe('2');
  });

  it('checks if a CellFormat has formatting', () => {
    const gridSparse = new GridSparse(gridOffsets);
    expect(gridSparse.hasNoFormatting({ x: 1, y: 2 })).toBe(true);
  });
});
