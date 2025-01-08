import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { DASHED } from '@/app/gridGL/generateTextures';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { drawDashedRectangleMarching } from '@/app/gridGL/UI/cellHighlights/cellHighlightsDraw';
import { getCSSVariableTint } from '@/app/helpers/convertColor';
import { CellRefRange } from '@/app/quadratic-core-types';
import { Graphics } from 'pixi.js';

const MARCH_TIME = 80;
const ALPHA = 0.5;

// walking rectangle offset
const RECT_OFFSET = 1;

export class UICopy extends Graphics {
  private sheetId?: string;
  private ranges?: CellRefRange[];
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
    return !!this.ranges && this.sheetId === sheets.sheet.id;
  }

  private updateNextTick = () => (this.dirty = true);

  clearCopyRanges = () => {
    this.clear();
    pixiApp.setViewportDirty();
    this.ranges = undefined;
    this.sheetId = undefined;
  };

  changeCopyRanges() {
    const range = sheets.sheet.cursor.getRanges();
    this.ranges = range;
    this.time = 0;
    this.march = 0;
    this.sheetId = sheets.sheet.id;
  }

  private draw() {
    if (!this.ranges) return;
    let render = false;
    this.ranges.forEach((cellRefRange) => {
      const color = getCSSVariableTint('primary');
      render ||= drawDashedRectangleMarching({
        g: this,
        color,
        march: this.march,
        noFill: true,
        alpha: ALPHA,
        offset: RECT_OFFSET,
        range: cellRefRange,
      });
    });
    if (render) {
      pixiApp.setViewportDirty();
    }
  }

  update() {
    if (!this.ranges) return;
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
