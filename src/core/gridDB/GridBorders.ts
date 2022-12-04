import { Rectangle } from 'pixi.js';
import { Coordinate } from '../gridGL/types/size';
import { GridOffsets } from './GridOffsets';
import { Border } from './gridTypes';

export class GridBorders {
  private gridOffsets: GridOffsets;
  private minX = 0;
  private maxX = 0;
  private minY = 0;
  private maxY = 0;
  borders = new Map<string, Border>();

  constructor(gridOffsets: GridOffsets) {
    this.gridOffsets = gridOffsets;
  }

  empty() {
    this.borders.clear();
    this.minX = 0;
    this.maxX = 0;
    this.minY = 0;
    this.maxY = 0;
  }

  private getKey(x?: number, y?: number): string {
    return `${x ?? ''},${y ?? ''}`;
  }

  populate(borders?: Border[]) {
    if (!borders?.length) {
      this.empty();
      return;
    }
    this.borders.clear();
    this.minX = Infinity;
    this.minY = Infinity;
    this.maxX = -Infinity;
    this.maxY = -Infinity;
    borders?.forEach((border) => {
      this.borders.set(this.getKey(border.x, border.y), border);
      this.minX = Math.min(this.minX, border.x);
      this.maxX = Math.max(this.maxX, border.x);
      this.minY = Math.min(this.minY, border.y);
      this.maxY = Math.max(this.maxY, border.y);
    });
  }

  get(x: number, y: number): Border | undefined {
    if (x < this.minX || x > this.maxX || y < this.minY || y > this.maxY) return;
    return this.borders.get(this.getKey(x, y));
  }

  clear(coordinates: Coordinate[]): void {
    coordinates.forEach(coordinate => this.borders.delete(this.getKey(coordinate.x, coordinate.y)));
  }

  update(borders: Border[]): void {
    borders.forEach(border => {
      this.borders.set(this.getKey(border.x, border.y), border);
    });
  }

  getBorders(bounds: Rectangle): Border[] {
    const borders: Border[] = [];
    for (let y = bounds.top; y <= bounds.bottom; y++) {
      for (let x = bounds.left; x <= bounds.right; x++) {
        const border = this.borders.get(this.getKey(x, y));
        if (border) borders.push(border);
      }
    }
    return borders;
  }

  getBounds(bounds: Rectangle): Rectangle {
    const columnStartIndex = this.gridOffsets.getColumnIndex(bounds.left);
    const columnStart = columnStartIndex.index > this.minX ? columnStartIndex.index : this.minX;
    const columnEndIndex = this.gridOffsets.getColumnIndex(bounds.right);
    const columnEnd = columnEndIndex.index < this.maxX ? columnEndIndex.index : this.maxX;

    const rowStartIndex = this.gridOffsets.getRowIndex(bounds.top);
    const rowStart = rowStartIndex.index > this.minY ? rowStartIndex.index : this.minY;
    const rowEndIndex = this.gridOffsets.getRowIndex(bounds.bottom);
    const rowEnd = rowEndIndex.index < this.maxY ? rowEndIndex.index : this.maxY;

    return new Rectangle(columnStart, rowStart, columnEnd - columnStart, rowEnd - rowStart);
  }

  getGridBounds(): Rectangle {
    return new Rectangle(this.minX, this.minY, this.maxX - this.minX, this.maxY - this.minY);
  }

  getArray(): Border[] {
    return Object.values(this.borders);
  }
}
