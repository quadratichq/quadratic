//! Keeps track of which grid lines should not be drawn within the sheet because of overflow.

import { JsCoordinate } from '@/app/quadratic-core-types';

export class GridOverflowLines {
  private overflowLines: Map<string, string>;

  constructor() {
    this.overflowLines = new Map();
  }

  // Updates a hash with a list of overflow lines
  updateHash(hashKey: string, coordinates: JsCoordinate[]) {
    // first remove all overflowLines from this hash
    this.overflowLines.forEach((value, key) => {
      if (value === hashKey) {
        this.overflowLines.delete(key);
      }
    });

    coordinates.forEach((coordinate) => {
      this.overflowLines.set(`${coordinate.x},${coordinate.y}`, hashKey);
    });
  }

  // returns a list of ranges of y-values that need to be drawn (excluding the
  // ones that are in the overflowLines list)
  getLinesInRange(column: number, row: [number, number]): [number, number][] | undefined {
    // if no overflow lines, then draw the entire screen
    if (this.overflowLines.size === 0) {
      return;
    }

    // create a list of y coordinates that need removing
    const inRangeSorted = [];
    for (let y = row[0]; y <= row[1]; y++) {
      const key = `${column},${y}`;
      if (this.overflowLines.has(key)) {
        inRangeSorted.push(y);
      }
    }

    // if there are no gaps, then draw the entire screen
    if (inRangeSorted.length === 0) {
      return undefined;
    }

    // now create a list of numbers that need to be drawn
    const drawnLines: number[] = [];
    for (let i = row[0]; i <= row[1]; i++) {
      if (!inRangeSorted.includes(i)) {
        drawnLines.push(i);
      }
    }

    // finally, create a list of ranges to draw
    const results: [number, number][] = [];
    for (let i = 0; i < drawnLines.length; i++) {
      let start = drawnLines[i];
      while (drawnLines[i + 1] - drawnLines[i] === 1) {
        i++;
      }
      results.push([start, drawnLines[i]]);
    }
    return results;
  }
}
