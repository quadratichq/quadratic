import { Rectangle } from 'pixi.js';
import { Coordinate, MinMax } from '../../gridGL/types/size';
import { GridOffsets } from './GridOffsets';
import { Border } from './gridTypes';
import { Quadrants } from '../../gridGL/quadrants/Quadrants';
import { Bounds } from './Bounds';

export class GridBorders {
  private gridOffsets: GridOffsets;
  private bounds = new Bounds();
  borders = new Map<string, Border>();

  // tracks which quadrants need to render based on GridBorders data
  quadrants: Set<string> = new Set();

  constructor(gridOffsets: GridOffsets) {
    this.gridOffsets = gridOffsets;
  }

  empty() {
    this.borders.clear();
    this.quadrants.clear();
    this.bounds.clear();
  }

  private getKey(x?: number, y?: number): string {
    return `${x ?? ''},${y ?? ''}`;
  }

  populate(borders?: Border[]) {
    this.empty();
    if (!borders?.length) return;
    this.borders.clear();
    this.quadrants.clear();
    borders?.forEach((border) => {
      this.borders.set(this.getKey(border.x, border.y), border);
      this.quadrants.add(Quadrants.getKey(border.x, border.y));
      this.bounds.add(border.x, border.y);
    });
  }

  recalculateBounds(): void {
    this.bounds.clear();
    if (this.borders.size === 0) return;
    this.borders.forEach((border) => {
      this.bounds.add(border.x, border.y);
    });
  }

  get(x: number, y: number): Border | undefined {
    if (this.bounds.contains(x, y)) {
      return this.borders.get(this.getKey(x, y));
    }
  }

  clear(coordinates: Coordinate[]): void {
    coordinates.forEach((coordinate) => this.borders.delete(this.getKey(coordinate.x, coordinate.y)));
    this.recalculateBounds();
  }

  update(borders: Border[]): void {
    borders.forEach((border) => {
      this.borders.set(this.getKey(border.x, border.y), border);
      this.quadrants.add(Quadrants.getKey(border.x, border.y));
      this.bounds.add(border.x, border.y);
    });
  }

  getBorders(bounds: Rectangle): Border[] {
    const borders: Border[] = [];
    for (let y = bounds.top; y <= bounds.bottom; y++) {
      for (let x = bounds.left; x <= bounds.right; x++) {
        if (this.bounds.contains(x, y)) {
          const border = this.borders.get(this.getKey(x, y));
          if (border) borders.push(border);
        }
      }
    }
    return borders;
  }

  getBounds(bounds: Rectangle): Rectangle {
    const { minX, minY, maxX, maxY } = this.bounds;
    const columnStartIndex = this.gridOffsets.getColumnIndex(bounds.left);
    const columnStart = columnStartIndex.index > minX ? columnStartIndex.index : minX;
    const columnEndIndex = this.gridOffsets.getColumnIndex(bounds.right);
    const columnEnd = columnEndIndex.index < maxX ? columnEndIndex.index : maxX;

    const rowStartIndex = this.gridOffsets.getRowIndex(bounds.top);
    const rowStart = rowStartIndex.index > minY ? rowStartIndex.index : minY;
    const rowEndIndex = this.gridOffsets.getRowIndex(bounds.bottom);
    const rowEnd = rowEndIndex.index < maxY ? rowEndIndex.index : maxY;

    return new Rectangle(columnStart, rowStart, columnEnd - columnStart, rowEnd - rowStart);
  }

  getGridBounds(): Rectangle | undefined {
    return this.bounds.toRectangle();
  }

  getRowMinMax(row: number): MinMax {
    const { minX, maxX } = this.bounds;
    let min = Infinity;
    let max = -Infinity;
    for (let x = minX; x <= maxX; x++) {
      if (this.get(x, row)) {
        min = x;
        break;
      }
    }
    for (let x = maxX; x >= minX; x--) {
      if (this.get(x, row)) {
        max = x;
        break;
      }
    }
    return { min, max };
  }

  getColumnMinMax(column: number): MinMax | undefined {
    const { minY, maxY } = this.bounds;
    let min = Infinity;
    let max = -Infinity;
    for (let y = minY; y <= maxY; y++) {
      if (this.get(column, y)) {
        min = y;
        break;
      }
    }
    for (let y = maxY; y >= minY; y--) {
      if (this.get(column, y)) {
        max = y;
        break;
      }
    }
    if (min === Infinity) return;
    return { min, max };
  }

  getArray(): Border[] {
    return Array.from(this.borders, ([_, border]) => border);
  }

  hasQuadrant(x: number, y: number): boolean {
    return this.quadrants.has(`${x},${y}`);
  }
}
