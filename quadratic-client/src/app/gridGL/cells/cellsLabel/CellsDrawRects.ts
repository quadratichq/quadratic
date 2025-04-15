import type { DrawRects } from '@/app/shared/types/size';
import { Container, Graphics } from 'pixi.js';

export class CellsDrawRects extends Container {
  clear() {
    this.removeChildren();
  }

  update(drawRects: DrawRects[]) {
    this.clear();
    drawRects.forEach(({ rects, tint }) => {
      rects.forEach((rect) => {
        const line = new Graphics();
        line.rect(rect.x, rect.y, rect.width, rect.height);
        line.fill({ color: tint });
        this.addChild(line);
      });
    });
  }
}
