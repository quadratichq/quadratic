import { pixiAppSettings } from '@/app/gridGL/pixiApp/PixiAppSettings';
import { getCSSVariableTint } from '@/app/helpers/convertColor';
import { Container, Graphics } from 'pixi.js';

export class CellsCodeOutlines extends Container {
  clear() {
    this.removeChildren();
  }

  update(codeOutlines: { x: number; y: number; width: number; height: number }[]) {
    this.clear();
    if (codeOutlines.length === 0) return;
    if (!pixiAppSettings.showCellTypeOutlines) return;

    const tint = getCSSVariableTint('muted-foreground');
    codeOutlines.forEach((rect) => {
      const g = new Graphics();
      g.lineStyle({ color: tint, width: 1, alignment: 0.5 });
      g.drawRect(rect.x, rect.y, rect.width, rect.height);
      this.addChild(g);
    });
  }
}
