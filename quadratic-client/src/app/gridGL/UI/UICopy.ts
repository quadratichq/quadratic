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
const ANTS_LUMINOSITY = 1.25;

// walking rectangle offset
const RECT_OFFSET = 1;

export class UICopy extends Graphics {
  private sheetId?: string;
  private ranges?: RefRangeBounds[];
  private time = 0;
  private march = 0;
  dirty = false;

  constructor() {
    super();
    events.on('changeSheet', this.setDirty);
    events.on('viewportChanged', this.setDirty);
    events.on('transactionStart', this.clearCopyRanges);
  }

  destroy() {
    events.off('changeSheet', this.setDirty);
    events.off('viewportChanged', this.setDirty);
    events.off('transactionStart', this.clearCopyRanges);
    super.destroy();
  }

  isShowing = (): boolean => {
    return !!this.ranges && this.sheetId === sheets.current;
  };

  private setDirty = () => {
    if (!!this.sheetId && !!this.ranges) {
      this.dirty = true;
    }
  };

  clearCopyRanges = () => {
    if (!!this.sheetId && !!this.ranges) {
      this.clear();
      this.ranges = undefined;
      this.sheetId = undefined;
      this.dirty = true;
      pixiApp.setViewportDirty();
    }
  };

  changeCopyRanges = () => {
    const finiteRanges = sheets.sheet.cursor.getFiniteRefRangeBounds();
    const infiniteRanges = sheets.sheet.cursor.getInfiniteRefRangeBounds();
    this.sheetId = sheets.current;
    this.ranges = [...finiteRanges, ...infiniteRanges];
    this.time = 0;
    this.march = 0;
    this.dirty = true;
  };

  private draw = () => {
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
      const color = getCSSVariableTint('primary', { luminosity: ANTS_LUMINOSITY });

      const offsets = {
        left: -RECT_OFFSET,
        top: RECT_OFFSET,
        right: RECT_OFFSET,
        bottom: -RECT_OFFSET,
      };

      drawDashedRectangleMarching({
        g: this,
        color,
        range,
        march: this.march,
        alpha: ALPHA,
        offsets,
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
  };

  update = () => {
    if (!this.dirty) return;

    if (this.sheetId !== sheets.current || !this.ranges) {
      this.clear();
      this.dirty = false;
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
    }
  };
}
