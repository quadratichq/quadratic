import { SheetOffsets } from './SheetOffsets';

const GRID_OFFSETS_CACHE_SIZE = 10000;

export class SheetOffsetsCache {
  private sheetOffsets: SheetOffsets;
  private columnCache: number[] = [];
  private rowCache: number[] = [];
  private columnNegativeCache: number[] = [];
  private rowNegativeCache: number[] = [];

  constructor(gridOffsets: SheetOffsets) {
    this.sheetOffsets = gridOffsets;
    this.clear();
  }

  clear() {
    this.columnCache = [0];
    this.rowCache = [0];
    this.columnNegativeCache = [0];
    this.rowNegativeCache = [0];
  }

  getColumnPlacement(column: number): { x: number; width: number } {
    let position = 0;
    if (column === 0) {
      return { x: 0, width: this.sheetOffsets.getColumnWidth(0) };
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

          position += this.sheetOffsets.getColumnWidth(x);
        }
      }

      // otherwise calculate the cache as you iterate
      else {
        for (let x = 0; x < column; x++) {
          // add to cache when needed
          if (x % GRID_OFFSETS_CACHE_SIZE === 0) {
            this.columnCache[x / GRID_OFFSETS_CACHE_SIZE] = position;
          }

          position += this.sheetOffsets.getColumnWidth(x);
        }
      }

      return { x: position, width: this.sheetOffsets.getColumnWidth(column) };
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
            position -= this.sheetOffsets.getColumnWidth(x);
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
            position -= this.sheetOffsets.getColumnWidth(x);
          }
        }
      }
      return { x: position, width: this.sheetOffsets.getColumnWidth(column) };
    }
  }

  getColumnIndex(x: number): { index: number; position: number } {
    if (x >= 0) {
      let cacheIndex = 0;
      while (this.columnCache[cacheIndex + 1] < x) cacheIndex++;
      let position = this.columnCache[cacheIndex];
      let index = cacheIndex * GRID_OFFSETS_CACHE_SIZE;
      let nextWidth = this.sheetOffsets.getColumnWidth(index);
      while (position + nextWidth <= x) {
        position += nextWidth;
        index++;
        nextWidth = this.sheetOffsets.getColumnWidth(index);
      }
      return { index, position };
    } else {
      let cacheIndex = 0;
      while (this.columnNegativeCache[cacheIndex + 1] > x) cacheIndex++;
      let position = this.columnNegativeCache[cacheIndex];
      let index = cacheIndex * GRID_OFFSETS_CACHE_SIZE;
      while (position > x) {
        index++;
        position -= this.sheetOffsets.getColumnWidth(-index);
      }
      return { index: -index, position };
    }
  }

  getRowPlacement(row: number): { y: number; height: number } {
    let position = 0;
    if (row === 0) {
      return { y: 0, height: this.sheetOffsets.getRowHeight(0) };
    }

    if (row > 0) {
      // use cache if available
      const closestIndex = Math.floor(row / GRID_OFFSETS_CACHE_SIZE);
      if (this.rowCache.length > closestIndex) {
        position = this.rowCache[closestIndex];
        for (let y = closestIndex * GRID_OFFSETS_CACHE_SIZE; y < row; y++) {
          // add to cache when needed
          if (y % GRID_OFFSETS_CACHE_SIZE === 0) {
            this.rowCache[y / GRID_OFFSETS_CACHE_SIZE] = position;
          }

          position += this.sheetOffsets.getRowHeight(y);
        }
      }

      // otherwise calculate the cache as you iterate
      else {
        for (let y = 0; y < row; y++) {
          // add to cache when needed
          if (y % GRID_OFFSETS_CACHE_SIZE === 0) {
            this.rowCache[y / GRID_OFFSETS_CACHE_SIZE] = position;
          }

          position += this.sheetOffsets.getRowHeight(y);
        }
      }

      return { y: position, height: this.sheetOffsets.getRowHeight(row) };
    }

    // calculate in the negative
    else {
      // use cache if available
      const closestIndex = Math.floor(-row / GRID_OFFSETS_CACHE_SIZE);
      if (this.rowNegativeCache.length > closestIndex) {
        position = this.columnNegativeCache[closestIndex];
        for (let y = -closestIndex * GRID_OFFSETS_CACHE_SIZE; y >= row; y--) {
          // add to cache when needed
          if (-y % GRID_OFFSETS_CACHE_SIZE === 0) {
            this.rowNegativeCache[-y / GRID_OFFSETS_CACHE_SIZE] = position;
          }
          if (y !== 0) {
            position -= this.sheetOffsets.getRowHeight(y);
          }
        }
      }

      // otherwise calculate the cache as you iterate
      else {
        for (let y = -1; y >= row; y--) {
          // add to cache when needed
          if (-y % GRID_OFFSETS_CACHE_SIZE === 0) {
            this.rowNegativeCache[-y / GRID_OFFSETS_CACHE_SIZE] = position;
          }

          if (y !== 0) {
            position -= this.sheetOffsets.getRowHeight(y);
          }
        }
      }
      return { y: position, height: this.sheetOffsets.getRowHeight(row) };
    }
  }

  getRowIndex(y: number): { index: number; position: number } {
    if (y >= 0) {
      let cacheIndex = 0;
      while (this.rowCache[cacheIndex + 1] < y) cacheIndex++;
      let position = this.rowCache[cacheIndex];
      let index = cacheIndex * GRID_OFFSETS_CACHE_SIZE;
      let nextHeight = this.sheetOffsets.getRowHeight(index);
      while (position + nextHeight <= y) {
        position += nextHeight;
        index++;
        nextHeight = this.sheetOffsets.getRowHeight(index);
      }
      return { index, position };
    } else {
      let cacheIndex = 0;
      while (this.rowNegativeCache[cacheIndex + 1] > y) cacheIndex++;
      let position = this.rowNegativeCache[cacheIndex];
      let index = cacheIndex * GRID_OFFSETS_CACHE_SIZE;
      while (position > y) {
        index++;
        position -= this.sheetOffsets.getRowHeight(-index);
      }
      return { index: -index, position };
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
