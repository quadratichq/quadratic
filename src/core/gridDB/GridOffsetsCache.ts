import { GridOffsets } from './GridOffsets';

const GRID_OFFSETS_CACHE_SIZE = 1000;

export class GridOffsetsCache {
  private gridOffsets: GridOffsets;
  private columnCache: number[] = [];
  private rowCache: number[] = [];
  private columnNegativeCache: number[] = [];
  private rowNegativeCache: number[] = [];

  constructor(gridOffsets: GridOffsets) {
    this.gridOffsets = gridOffsets;
  }

  clear() {
    this.columnCache = [0];
    this.rowCache = [0];
    this.columnNegativeCache = [0];
    this.rowNegativeCache = [0];
  }

  getColumnPlacement(column: number): { x: number, width: number } {
    let position = 0;
    if (column === 0) {
      return { x: 0, width: this.gridOffsets.getColumnWidth(0) };
    }

    if (column > 0) {

      // use cache if available
      const closestIndex = Math.floor(column / GRID_OFFSETS_CACHE_SIZE);
      if (this.columnCache.length > closestIndex) {
        position = this.columnCache[closestIndex];
        for (let x = closestIndex * GRID_OFFSETS_CACHE_SIZE; x < column; x++) {

          // add to cache when needed
          if (x % GRID_OFFSETS_CACHE_SIZE === 0) {
            this.columnCache[x / GRID_OFFSETS_CACHE_SIZE] = position;
          }

          position += this.gridOffsets.getColumnWidth(x);
        }
      }

      // otherwise calculate the cache as you iterate
      else {
        for (let x = 0; x < column; x++) {

          // add to cache when needed
          if (x % GRID_OFFSETS_CACHE_SIZE === 0) {
            this.columnCache[x / GRID_OFFSETS_CACHE_SIZE] = position;
          }

          position += this.gridOffsets.getColumnWidth(x);
        }
      }

      return { x: position, width: this.gridOffsets.getColumnWidth(column) };
    }

    // calculate in the negative
    else {

      // use cache if available
      const closestIndex = Math.floor(-column / GRID_OFFSETS_CACHE_SIZE);
      if (this.columnNegativeCache.length > closestIndex) {
        position = this.columnNegativeCache[closestIndex];
        for (let x = -closestIndex * GRID_OFFSETS_CACHE_SIZE; x >= column; x--) {
          // add to cache when needed
          if (-x % GRID_OFFSETS_CACHE_SIZE === 0) {
            this.columnNegativeCache[-x / GRID_OFFSETS_CACHE_SIZE] = position;
          }
          if (x !== 0) {
            position -= this.gridOffsets.getColumnWidth(x);
          }
        }
      }

      // otherwise calculate the cache as you iterate
      else {
        for (let x = -1; x >= column; x--) {
          // add to cache when needed
          if (-x % GRID_OFFSETS_CACHE_SIZE === 0) {
            this.columnNegativeCache[-x / GRID_OFFSETS_CACHE_SIZE] = position;
          }

          if (x !== 0) {
            position -= this.gridOffsets.getColumnWidth(x);
          }
        }
      }
      return { x: position, width: this.gridOffsets.getColumnWidth(column) - 1 };
    }
  }

  getColumnIndex(x: number): { index: number; position: number } {
    if (x >= 0) {
      let index = 0;
      let position = 0;
      let nextWidth = this.gridOffsets.getColumnWidth(0);
      while (position + nextWidth < x) {
        position += nextWidth;
        index++;
        nextWidth = this.gridOffsets.getColumnWidth(index);
      }
      return { index, position };
    } else {
      let index = 0;
      let position = 0;
      while (position > x) {
        index--;
        position -= this.gridOffsets.getColumnWidth(index);
      }
      return { index, position };
    }
  }


  debugSize(): void {
    console.log({
      columnCache: this.columnCache.length,
      rowCache: this.rowCache.length,
      columnNegativeCache: this.columnNegativeCache.length,
      rowNegativeCache: this.rowNegativeCache.length,
    });
  }
}