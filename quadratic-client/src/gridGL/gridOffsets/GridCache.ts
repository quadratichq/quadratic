const CACHE_INTERVAL = 10000;

export class GridCache {
  private cache: Record<number, number> = {};

  get(index: number) {
    const check = index % CACHE_INTERVAL;
    let startEntry: number;
    let value: number;
    if (this.cache[check]) {
      startEntry = check;
    } else {
      if (index < 0) {
        do {} while (index !== 0);
      }
    }
  }
}
