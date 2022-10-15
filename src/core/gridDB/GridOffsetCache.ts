import { Heading } from './db';

// this is the spacing between cached values (so we don't have to hold all values in memory)
const PLACEMENTS = 100;

export class GridOffsetCache {

  private minimum = 0;
  private maximum = 0;

  // the key is cached index / PLACEMENTS
  private cachePositive: number[] = [];
  private cacheNegative: number[] = [];

  clear() {
    this.minimum = 0;
    this.maximum = 0;
    this.cachePositive = [];
    this.cacheNegative = [];
  }

  private fillCachePositive(headings: Heading[], index: number, defaultSize: number): void {
    let position = this.cachePositive[this.maximum] ?? 0;
    for (let i = this.maximum; i <= index; i++) {
      position += headings[i]?.size ?? defaultSize;
      if (i % PLACEMENTS === 0) {
        this.cachePositive[i / PLACEMENTS] = position;
      }
    }
    this.maximum = index;
  }

  private fillCacheNegative(headings: Heading[], index: number, defaultSize: number): void {
    let position = this.cacheNegative[this.minimum] ?? 0;
    for (let i = this.maximum; i <= index; i++) {
      position -= headings[ i]?.size ?? defaultSize;
      if (i % PLACEMENTS === 0) {
        this.cacheNegative[-i / PLACEMENTS] = position;
      }
    }
    this.minimum = index;
  }

  get(index: number, headings: Heading[], defaultSize: number): { position: number, size: number } {
    if (index >= 0) {
      const check = Math.floor(index / PLACEMENTS) * PLACEMENTS;
      if (this.maximum < check) {
        this.fillCachePositive(headings, check, defaultSize);
      }
      let position = this.cachePositive[check / PLACEMENTS];
      for (let i = check; i < index; i++) {
        position += headings[i]?.size ?? defaultSize;
      }
      return { position: position, size: headings[index]?.size ?? defaultSize };
    } else {
      const check = -Math.floor(index / PLACEMENTS) * PLACEMENTS;
      if (this.minimum > check) {
        this.fillCachePositive(headings, check, defaultSize);
      }
      let position = this.cachePositive[check / PLACEMENTS];
      for (let i = check; i < index; i++) {
        position += headings[i]?.size ?? defaultSize;
      }
      return { position: position, size: headings[index]?.size ?? defaultSize };

    }
  }
}