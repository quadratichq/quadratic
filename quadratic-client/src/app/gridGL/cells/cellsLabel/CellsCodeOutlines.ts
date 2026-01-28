import { pixiAppSettings } from '@/app/gridGL/pixiApp/PixiAppSettings';
import { getCSSVariableTint } from '@/app/helpers/convertColor';
import { Graphics } from 'pixi.js';

export class CellsCodeOutlines extends Graphics {
  update(codeOutlines: { x: number; y: number; width: number; height: number }[]) {
    this.clear();
    if (codeOutlines.length === 0) return;
    if (!pixiAppSettings.showCellTypeOutlines) return;

    const tint = getCSSVariableTint('muted-foreground');
    this.lineStyle({ color: tint, width: 1, alignment: 0.5 });

    codeOutlines.forEach((rect) => {
      this.drawRect(rect.x, rect.y, rect.width, rect.height);
    });
  }
}
