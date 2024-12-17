import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { DASHED } from '@/app/gridGL/generateTextures';
import { intersects } from '@/app/gridGL/helpers/intersects';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { drawDashedRectangleMarching } from '@/app/gridGL/UI/cellHighlights/cellHighlightsDraw';
import { getCSSVariableTint } from '@/app/helpers/convertColor';
import { RefRangeBounds } from '@/app/quadratic-core-types';
import { Graphics } from 'pixi.js';

const MARCH_TIME = 80;

// walking rectangle offset
const RECT_OFFSET = 1;

export class UICopy extends Graphics {
  private sheetId?: string;
  private range?: RefRangeBounds;
  private time = 0;
  private march = 0;
  private dirty = false;

  constructor() {
    super();
    events.on('changeSheet', this.updateNextTick);
    events.on('viewportChanged', this.updateNextTick);
    events.on('transactionStart', this.clearCopyRange);
  }

  destroy() {
    events.off('changeSheet', this.updateNextTick);
    events.off('transactionStart', this.clearCopyRange);
    super.destroy();
  }

  private updateNextTick = () => (this.dirty = true);

  private clearCopyRange = () => this.changeCopyRange();

  changeCopyRange(range?: RefRangeBounds) {
    if (!range) {
      this.clear();
      this.range = undefined;
      this.sheetId = undefined;
    } else {
      this.range = range;
      this.time = 0;
      this.march = 0;
      this.sheetId = sheets.sheet.id;
    }
  }

  private draw() {
    if (!this.range) return;
    const bounds = pixiApp.viewport.getVisibleBounds();
    let minX = Number(this.range.start.col.coord);
    let minY = Number(this.range.start.row.coord);
    let maxX: number;
    if (this.range.end.col.coord < 0) {
      maxX = bounds.width + DASHED;
    } else {
      minX = Math.min(minX, Number(this.range.end.col.coord));
      maxX = Math.max(Number(this.range.start.col.coord), Number(this.range.end.col.coord));
    }
    let maxY: number;
    if (this.range.end.row.coord < 0) {
      maxY = bounds.height + DASHED;
    } else {
      minY = Math.min(minY, Number(this.range.end.row.coord));
      maxY = Math.max(Number(this.range.start.row.coord), Number(this.range.end.row.coord));
    }
    const rect = sheets.sheet.getScreenRectangle(minX, minY, maxX - minX + 1, maxY - minY + 1);
    rect.x += RECT_OFFSET;
    rect.y += RECT_OFFSET;
    rect.width -= RECT_OFFSET * 2;
    rect.height -= RECT_OFFSET * 2;
    const color = getCSSVariableTint('primary');
    drawDashedRectangleMarching(this, color, rect, this.march, true);

    if (intersects.rectangleRectangle(rect, bounds)) {
      pixiApp.setViewportDirty();
    }
  }

  update() {
    if (!this.range) return;
    if (this.sheetId !== sheets.sheet.id) {
      this.clear();
      return;
    }
    const drawFrame = Date.now() - this.time > MARCH_TIME;
    if (drawFrame) {
      this.march = (this.march + 1) % Math.floor(DASHED);
      this.time = Date.now();
    }
    if (drawFrame || this.dirty) {
      this.clear();
      this.draw();
      this.dirty = false;
    }
  }
}
