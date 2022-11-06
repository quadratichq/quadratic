import { PixiApp } from '../pixiApp/PixiApp';
import { Quadrant } from './Quadrant';
import { QUADRANT_SIZE } from './quadrantConstants';

export class Quadrants {
  private app: PixiApp;
  private quadrants = new Map<string, Quadrant>();

  constructor(app: PixiApp) {
    this.app = app;
  }

  getKey(x: number, y: number): string {
    return `${x},${y}`;
  }

  populate() {
    this.quadrants.clear();

    // this.app.grid.cells.forEach(cell => )
    const bounds = this.app.grid.getGridBounds();
    const top = Math.floor(bounds.top / QUADRANT_SIZE);
    const bottom = Math.floor(bounds.bottom / QUADRANT_SIZE);
    const left = Math.floor(bounds.left / QUADRANT_SIZE);
    const right = Math.floor(bounds.right / QUADRANT_SIZE);

    for (let y = top; y <= bottom; y++) {
      for (let x = left; x <= right; x++) {
        const key = this.getKey(x, y);
        this.quadrants.set(key, new Quadrant(this.app, x, y));
      }
    }
  }

  update(): void {
    this.quadrants.forEach(quadrant => quadrant.update());
  }
}