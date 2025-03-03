import type { DrawRects } from '@/app/gridGL/types/size';
import { Container, Graphics } from 'pixi.js';

export class CellsDrawRects extends Container {
  clear() {
    this.removeChildren();
  }

  update(drawRects: DrawRects[]) {
    this.clear();
    drawRects.forEach(({ rects, tint }) => {
      rects.forEach((rect) => {
        const line = new Graphics().beginFill(tint).drawRect(rect.x, rect.y, rect.width, rect.height).endFill();
        this.addChild(line);
      });
    });
  }
}
