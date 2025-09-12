//! Keeps track of which grid lines should not be drawn within the sheet because
//! of overflow of text, images, and html tables..

import { events } from '@/app/events/events';
import type { Sheet } from '@/app/grid/sheet/Sheet';
import type { JsCoordinate } from '@/app/quadratic-core-types';
import { Rectangle } from 'pixi.js';

export class GridOverflowLines {
  private sheet: Sheet;

  // hold overflow lines (we do not draw grid lines for cells that overlap neighbors)
  private overflowLines: Map<string, string>;

  // holds the rectangles of images and html tables so we don't draw grid lines over them
  private overflowImageHtml: Map<string, Rectangle>;

  constructor(sheet: Sheet) {
    this.sheet = sheet;
    this.overflowLines = new Map();
    this.overflowImageHtml = new Map();
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

  // updates the hash with a rectangle of an image or html table
  updateImageHtml(column: number, row: number, width?: number, height?: number) {
    if (width === undefined || height === undefined) {
      this.overflowImageHtml.delete(`${column},${row}`);
    } else {
      this.overflowImageHtml.set(`${column},${row}`, new Rectangle(column, row, width - 1, height - 1));
    }
    events.emit('setDirty', { gridLines: true });
  }

  // returns a list of ranges of y-values that need to be drawn (excluding the
  // ones that are in the overflowLines list)
  getColumnVerticalRange(column: number, rows: [number, number]): [number, number][] | undefined {
    // if no overflow lines, then draw the entire screen
    if (this.overflowLines.size === 0 && this.overflowImageHtml.size === 0) {
      return;
    }

    // create a list of y coordinates that need removing
    const inRange = [];
    for (let y = rows[0]; y <= rows[1]; y++) {
      const key = `${column},${y}`;
      if (this.overflowLines.has(key)) {
        inRange.push(y);
      }
    }

    this.overflowImageHtml.forEach((rect) => {
      if (column >= rect.left && column <= rect.right) {
        for (let y = rect.top; y <= rect.bottom; y++) {
          inRange.push(y);
        }
      }
    });

    // if there are no gaps, then draw the entire screen
    if (inRange.length === 0) {
      return undefined;
    }

    // now create a list of numbers that need to be drawn
    const drawnLines: number[] = [];
    for (let y = rows[0]; y <= rows[1]; y++) {
      if (!inRange.includes(y)) {
        drawnLines.push(y);
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

  // returns a list of ranges of x-values that need to be drawn (excluding the
  // ones that are in the overflowImageHtml list)
  getRowHorizontalRange(row: number, columns: [number, number]): [number, number][] | undefined {
    // if no overflow lines, then draw the entire screen
    if (this.overflowLines.size === 0 && this.overflowImageHtml.size === 0) {
      return;
    }

    // create a list of x coordinates that need removing
    const inRange: number[] = [];
    this.overflowImageHtml.forEach((rect) => {
      if (row >= rect.top && row <= rect.bottom) {
        for (let x = rect.left; x <= rect.right; x++) {
          inRange.push(x);
        }
      }
    });

    // now create a list of numbers that need to be drawn
    const drawnLines: number[] = [];
    for (let i = columns[0]; i <= columns[1]; i++) {
      if (!inRange.includes(i)) {
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
