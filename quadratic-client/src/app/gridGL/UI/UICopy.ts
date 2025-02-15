import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { DASHED } from '@/app/gridGL/generateTextures';
import { intersects } from '@/app/gridGL/helpers/intersects';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { drawDashedRectangleMarching } from '@/app/gridGL/UI/cellHighlights/cellHighlightsDraw';
import { getCSSVariableTint } from '@/app/helpers/convertColor';
import type { RefRangeBounds } from '@/app/quadratic-core-types';
import { Graphics } from 'pixi.js';

const MARCH_TIME = 80;
const ALPHA = 0.5;

// walking rectangle offset
const RECT_OFFSET = 1;

export class UICopy extends Graphics {
  private sheetId?: string;
  private ranges?: RefRangeBounds[];
  private time = 0;
  private march = 0;
  private dirty = false;

  constructor() {
    super();
    events.on('changeSheet', this.updateNextTick);
    events.on('viewportChanged', this.updateNextTick);
    events.on('transactionStart', this.clearCopyRanges);
  }

  destroy() {
    events.off('changeSheet', this.updateNextTick);
    events.off('viewportChanged', this.updateNextTick);
    events.off('transactionStart', this.clearCopyRanges);
    super.destroy();
  }

  isShowing(): boolean {
    return !!this.ranges && this.sheetId === sheets.current;
  }

  private updateNextTick = () => (this.dirty = true);

  clearCopyRanges = () => {
    this.clear();
    pixiApp.setViewportDirty();
    this.ranges = undefined;
    this.sheetId = undefined;
  };

  changeCopyRanges() {
    const range = sheets.sheet.cursor.getFiniteRefRangeBounds();
    this.ranges = range;
    this.time = 0;
    this.march = 0;
    this.sheetId = sheets.current;
  }

  private draw() {
    if (!this.ranges) return;
    const bounds = pixiApp.viewport.getVisibleBounds();
    let render = false;
    this.ranges.forEach((range) => {
      let minX = Number(range.start.col.coord);
      let minY = Number(range.start.row.coord);
      let maxX: number;
      if (range.end.col.coord < 0) {
        maxX = bounds.width + DASHED;
      } else {
        minX = Math.min(minX, Number(range.end.col.coord));
        maxX = Math.max(Number(range.start.col.coord), Number(range.end.col.coord));
      }
      let maxY: number;
      if (range.end.row.coord < 0) {
        maxY = bounds.height + DASHED;
      } else {
        minY = Math.min(minY, Number(range.end.row.coord));
        maxY = Math.max(Number(range.start.row.coord), Number(range.end.row.coord));
      }
      const rect = sheets.sheet.getScreenRectangle(minX, minY, maxX - minX + 1, maxY - minY + 1);
      rect.x += RECT_OFFSET;
      rect.y += RECT_OFFSET;
      rect.width -= RECT_OFFSET * 2;
      rect.height -= RECT_OFFSET * 2;
      const color = getCSSVariableTint('primary');
      drawDashedRectangleMarching({
        g: this,
        color,
        range,
        march: this.march,
        alpha: ALPHA,
        offset: RECT_OFFSET,
        noFill: true,
      });
      if (!render) {
        if (intersects.rectangleRectangle(rect, bounds)) {
          render = true;
        }
      }
    });
    if (render) {
      pixiApp.setViewportDirty();
    }
  }

  update() {
    if (!this.ranges) return;
    if (this.sheetId !== sheets.current) {
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
