import { Rectangle } from 'pixi.js';
import { GridOffsets } from '../GridOffsets';
import { GridSparse } from '../GridSparse';
import { CELL_HEIGHT, CELL_WIDTH } from '../../../constants/gridConstants';
import { Cell } from '../gridTypes';

describe('gridSparse', () => {
  const gridOffsets = new GridOffsets();

  it('creates an empty gridSparse', () => {
    const gridSparse = new GridSparse(gridOffsets);
    gridSparse.populate();
    expect(gridSparse.isEmpty).toBe(true);
    expect(gridSparse.get(0, 0)).toBeUndefined();

    const { bounds, boundsWithData } = gridSparse.getBounds(new Rectangle(-1000, -2000, 2000, 4000));

    expect(boundsWithData).toBeUndefined();

    expect(bounds.left).toBe(-1000 / CELL_WIDTH);
    expect(bounds.top).toBe(-2000 / CELL_HEIGHT);

    // -1 b/c it starts at 0
    expect(bounds.right).toBe(1000 / CELL_WIDTH - 1);
    expect(bounds.bottom).toBe(2000 / CELL_HEIGHT - 1);
  });

  it('populates cells with 1 cell of data (positive)', () => {
    const gridSparse = new GridSparse(gridOffsets);
    gridSparse.populate([{
      x: 1,
      y: 2,
    } as Cell]);

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
    gridSparse.populate([{
      x: -1,
      y: -2,
    } as Cell]);

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
      } as Cell
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
    gridSparse.populate([], [{
      x: 1,
      y: 2,
    } as Cell]);

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
    gridSparse.populate([], [{
      x: -1,
      y: -2,
    } as Cell]);

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
    gridSparse.populate([], [
      {
        x: -1,
        y: -2,
      } as Cell,
      {
        x: 1,
        y: 2,
      } as Cell
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

    expect(gridSparse.getCell(1, 2)).toBeUndefined();
    expect(gridSparse.getCell(-1, -2)).toBeUndefined();
    expect(gridSparse.getCell(0, 0)).toBeUndefined();
    expect(gridSparse.getFormat(-1, -2)).toBeDefined();
    expect(gridSparse.getFormat(1, 2)).toBeDefined();
    expect(gridSparse.getFormat(0, 0)).toBeUndefined();
  });

});