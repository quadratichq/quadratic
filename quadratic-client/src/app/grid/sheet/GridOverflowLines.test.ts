import { GridOverflowLines } from '@/app/grid/sheet/GridOverflowLines';
import { describe, expect, it } from 'vitest';

describe('GridOverflowLines', () => {
  it('getLinesInRange', () => {
    const gridOverflowLines = new GridOverflowLines();
    gridOverflowLines.updateHash('0,0', [{ x: 1, y: 1 }]);
    let lines = gridOverflowLines.getLinesInRange(1, [0, 5]);
    expect(lines).toEqual([
      [0, 0],
      [2, 5],
    ]);

    gridOverflowLines.updateHash('0,0', [
      { x: 1, y: 1 },
      { x: 1, y: 2 },
    ]);
    lines = gridOverflowLines.getLinesInRange(1, [0, 5]);
    expect(lines).toEqual([
      [0, 0],
      [3, 5],
    ]);

    gridOverflowLines.updateHash('0,0', [
      { x: 1, y: 1 },
      { x: 1, y: 2 },
      { x: 1, y: 4 },
    ]);
    lines = gridOverflowLines.getLinesInRange(1, [0, 5]);
    expect(lines).toEqual([
      [0, 0],
      [3, 3],
      [5, 5],
    ]);
  });
});
