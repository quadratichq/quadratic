//! Draws marching ants around the format painter source selection.
//! Similar to UICopy.ts but uses a different color to distinguish from copy.

import { deactivateFormatPainter, isFormatPainterActive } from '@/app/atoms/formatPainterAtom';
import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { DASHED } from '@/app/gridGL/generateTextures';
import { intersects } from '@/app/gridGL/helpers/intersects';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { drawDashedRectangleMarching } from '@/app/gridGL/UI/cellHighlights/cellHighlightsDraw';
import { getCSSVariableTint } from '@/app/helpers/convertColor';
import type { RefRangeBounds } from '@/app/quadratic-core-types';
import { JsSelection } from '@/app/quadratic-core/quadratic_core';
import { Graphics } from 'pixi.js';

const MARCH_TIME = 80;
const ALPHA = 0.5;
// Use a different luminosity to distinguish from copy
const ANTS_LUMINOSITY = 1.1;

// walking rectangle offset
const RECT_OFFSET = 1;

export class UIFormatPainter extends Graphics {
  private sourceSheetId?: string;
  private sourceSelection?: string;
  private ranges?: RefRangeBounds[];
  private time = 0;
  private march = 0;
  dirty = false;

  constructor() {
    super();
    events.on('changeSheet', this.onChangeSheet);
    events.on('viewportChanged', this.onViewportChanged);
    events.on('formatPainterStart', this.onFormatPainterStart);
    events.on('formatPainterEnd', this.onFormatPainterEnd);
  }

  destroy() {
    events.off('changeSheet', this.onChangeSheet);
    events.off('viewportChanged', this.onViewportChanged);
    events.off('formatPainterStart', this.onFormatPainterStart);
    events.off('formatPainterEnd', this.onFormatPainterEnd);
    super.destroy();
  }

  isShowing = (): boolean => {
    return !!this.ranges && this.sourceSheetId === sheets.current;
  };

  // Always mark dirty on sheet change so we can clear graphics when leaving source sheet
  private onChangeSheet = () => {
    if (!!this.sourceSheetId && !!this.ranges) {
      this.dirty = true;
    }
  };

  // Only mark dirty on viewport changes when viewing the source sheet
  private onViewportChanged = () => {
    if (!!this.sourceSheetId && !!this.ranges && this.sourceSheetId === sheets.current) {
      this.dirty = true;
    }
  };

  private onFormatPainterStart = (sourceSelection: string, sourceSheetId: string) => {
    this.sourceSelection = sourceSelection;
    this.sourceSheetId = sourceSheetId;
    this.updateRangesFromSelection();
    this.time = 0;
    this.march = 0;
    this.dirty = true;
  };

  private onFormatPainterEnd = () => {
    this.clearFormatPainter(false);
  };

  private updateRangesFromSelection = () => {
    if (!this.sourceSelection || !this.sourceSheetId) {
      this.ranges = undefined;
      return;
    }

    try {
      const selection = new JsSelection(this.sourceSheetId);
      selection.load(this.sourceSelection);
      const finiteRanges = selection.getFiniteRefRangeBounds(sheets.jsA1Context, sheets.sheet.mergeCells);
      const infiniteRanges = selection.getInfiniteRefRangeBounds();
      this.ranges = [...finiteRanges, ...infiniteRanges];
    } catch (e) {
      console.error('Failed to parse format painter selection:', e);
      this.ranges = undefined;
    }
  };

  clearFormatPainter = (emitEvent = true) => {
    if (!!this.sourceSheetId && !!this.ranges) {
      this.clear();
      this.ranges = undefined;
      this.sourceSheetId = undefined;
      this.sourceSelection = undefined;
      this.dirty = true;
      pixiApp.setViewportDirty();

      // Also update the atom state
      if (isFormatPainterActive()) {
        deactivateFormatPainter();
        if (emitEvent) {
          events.emit('formatPainterEnd');
        }
      }
    }
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

      // Use secondary color for format painter to distinguish from copy
      const color = getCSSVariableTint('secondary', { luminosity: ANTS_LUMINOSITY });

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

    if (this.sourceSheetId !== sheets.current || !this.ranges) {
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
