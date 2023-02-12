import { Rectangle } from 'pixi.js';
import { Coordinate } from '../gridGL/types/size';

export class Bounds {
  empty = true;
  minX = Infinity;
  minY = Infinity;
  maxX = -Infinity;
  maxY = -Infinity;

  clear() {
    this.empty = true;
    this.minX = Infinity;
    this.minY = Infinity;
    this.maxX = -Infinity;
    this.maxY = -Infinity;
  }

  add(x: number, y: number): void {
    this.minX = Math.min(this.minX, x);
    this.minY = Math.min(this.minY, y);
    this.maxX = Math.max(this.maxX, x);
    this.maxY = Math.max(this.maxY, y);
    this.empty = false;
  }

  addCoordinate(coordinate: Coordinate): void {
    this.add(coordinate.x, coordinate.y);
  }

  /** copies Bounds and overwrites existing bounds */
  copy(bounds: Bounds): void {
    this.empty = bounds.empty;
    this.minX = bounds.minX;
    this.minY = bounds.minY;
    this.maxX = bounds.maxX;
    this.maxY = bounds.maxY;
  }

  /**
   * Merges multiple bounds into this bounds (keeping existing bounds)
   * @param bounds
   */
  mergeInto(...boundsList: Bounds[]): void {
    if (boundsList.length === 0) return;
    if (boundsList.filter(bounds => !bounds.empty).length === 0) return;
    this.empty = false;
    boundsList.forEach(bounds => {
      this.minX = Math.min(this.minX, bounds.minX);
      this.minY = Math.min(this.minY, bounds.minY);
      this.maxX = Math.max(this.maxX, bounds.maxX);
      this.maxY = Math.max(this.maxY, bounds.maxY);
    });
  }

  contains(x: number, y: number): boolean {
    if (this.empty) return false;
    return x >= this.minX && x <= this.maxX && y >= this.minY && y <= this.maxY;
  }

  containsCoordinate(coordinate: Coordinate): boolean {
    return this.contains(coordinate.x, coordinate.y);
  }

  toRectangle(): Rectangle | undefined {
    if (this.empty) return;
    return new Rectangle(this.minX, this.minY, this.maxX - this.minX, this.maxY - this.minY);
  }
}