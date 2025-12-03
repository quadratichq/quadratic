import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { DASHED } from '@/app/gridGL/generateTextures';
import { intersects } from '@/app/gridGL/helpers/intersects';
import { getRangeScreenRectangleFromCellRefRange } from '@/app/gridGL/helpers/selection';
import { inlineEditorHandler } from '@/app/gridGL/HTMLGrid/inlineEditor/inlineEditorHandler';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { drawDashedRectangle, drawDashedRectangleMarching } from '@/app/gridGL/UI/cellHighlights/cellHighlightsDraw';
import { FILL_SELECTION_ALPHA } from '@/app/gridGL/UI/Cursor';
import { isUnbounded } from '@/app/gridGL/UI/drawCursor';
import { convertColorStringToTint } from '@/app/helpers/convertColor';
import type { CellRefRange, JsCellsAccessed, RefRangeBounds } from '@/app/quadratic-core-types';
import { colors } from '@/app/theme/colors';
import { Container, Graphics } from 'pixi.js';

const NUM_OF_CELL_REF_COLORS = colors.cellHighlightColor.length;
const MARCH_ANIMATE_TIME_MS = 80;

export class CellHighlights extends Container {
  private cellsAccessed: JsCellsAccessed[] = [];
  private selectedCellIndex: number | undefined;

  private highlights: Graphics;
  private marchingHighlight: Graphics;
  private march = 0;
  private marchLastTime = 0;
  private isPython = false;
  private hasInfiniteRanges = false;
  private lastViewportBounds: { x: number; y: number; width: number; height: number } | null = null;

  dirty = false;

  constructor() {
    super();
    this.highlights = this.addChild(new Graphics());
    this.marchingHighlight = this.addChild(new Graphics());
    events.on('changeSheet', this.setDirty);
    events.on('sheetOffsetsUpdated', this.setDirty);
  }

  destroy() {
    events.off('changeSheet', this.setDirty);
    events.off('sheetOffsetsUpdated', this.setDirty);
    events.off('viewportChanged', this.setDirty);
    super.destroy();
  }

  setDirty = () => {
    if (this.cellsAccessed.length) {
      this.dirty = true;
    }
  };

  clear = () => {
    this.cellsAccessed = [];
    this.selectedCellIndex = undefined;
    if (this.hasInfiniteRanges) {
      events.off('viewportChanged', this.setDirty);
      this.hasInfiniteRanges = false;
    }
    this.highlights.clear();
    this.marchingHighlight.clear();
    this.dirty = false;
    pixiApp.setViewportDirty();
  };

  private convertCellRefRangeToRefRangeBounds(
    cellRefRange: CellRefRange,
    isPython: boolean
  ): RefRangeBounds | undefined {
    try {
      return sheets.cellRefRangeToRefRangeBounds(cellRefRange, isPython);
    } catch (e) {
      console.log(`Error converting CellRefRange to RefRangeBounds: ${e}`);
    }
  }

  private isRangeInfinite(range: RefRangeBounds): boolean {
    return isUnbounded(range.end.col.coord) || isUnbounded(range.end.row.coord);
  }

  private checkForInfiniteRanges() {
    const hadInfiniteRanges = this.hasInfiniteRanges;
    this.hasInfiniteRanges = false;

    for (const { sheetId, ranges } of this.cellsAccessed) {
      if (sheetId !== sheets.current) continue;
      for (const range of ranges) {
        const refRangeBounds = this.convertCellRefRangeToRefRangeBounds(range, this.isPython);
        if (refRangeBounds && this.isRangeInfinite(refRangeBounds)) {
          this.hasInfiniteRanges = true;
          break;
        }
      }
      if (this.hasInfiniteRanges) break;
    }

    // Update viewport listener based on whether we have infinite ranges
    if (this.hasInfiniteRanges && !hadInfiniteRanges) {
      events.on('viewportChanged', this.setDirty);
    } else if (!this.hasInfiniteRanges && hadInfiniteRanges) {
      events.off('viewportChanged', this.setDirty);
    }
  }

  private draw = () => {
    this.highlights.clear();

    if (!this.cellsAccessed.length) return;

    this.cellsAccessed.forEach(({ sheetId, ranges }, index) => {
      if (sheetId !== sheets.current) return;

      // Skip drawing normal highlight for selected cell when marching is shown
      // (marching is shown when selectedCellIndex is defined and cursor is moving OR cells are accessed)
      if (this.selectedCellIndex === index && (inlineEditorHandler.cursorIsMoving || !!this.cellsAccessed.length)) {
        return;
      }

      ranges.forEach((range, i) => {
        const refRangeBounds = this.convertCellRefRangeToRefRangeBounds(range, this.isPython);
        if (refRangeBounds) {
          drawDashedRectangle({
            g: this.highlights,
            color: convertColorStringToTint(colors.cellHighlightColor[index % NUM_OF_CELL_REF_COLORS]),
            isSelected: false, // Never fill selected cell here since marching handles it
            range: refRangeBounds,
          });
        }
      });
    });

    this.dirty = false;
  };

  // Draws the marching highlights by using an offset dashed line to create the
  // marching effect.
  private updateMarchingHighlight = () => {
    if (!inlineEditorHandler.cursorIsMoving && !this.cellsAccessed.length) {
      this.marchingHighlight.clear();
      this.selectedCellIndex = undefined;
      return;
    }

    // Index may not have been set yet.
    if (this.selectedCellIndex === undefined) {
      this.marchingHighlight.clear();
      return;
    }

    // Check if viewport has changed (important for infinite ranges)
    const currentBounds = pixiApp.viewport.getVisibleBounds();
    const viewportChanged =
      !this.lastViewportBounds ||
      this.lastViewportBounds.x !== currentBounds.x ||
      this.lastViewportBounds.y !== currentBounds.y ||
      this.lastViewportBounds.width !== currentBounds.width ||
      this.lastViewportBounds.height !== currentBounds.height;

    // For infinite ranges, always update when viewport changes (bypass throttle)
    // Otherwise, throttle based on time for animation
    if (!viewportChanged) {
      if (this.marchLastTime === 0) {
        this.marchLastTime = Date.now();
      } else if (Date.now() - this.marchLastTime < MARCH_ANIMATE_TIME_MS) {
        return;
      }
    }

    this.marchLastTime = Date.now();
    this.lastViewportBounds = {
      x: currentBounds.x,
      y: currentBounds.y,
      width: currentBounds.width,
      height: currentBounds.height,
    };

    const selectedCellIndex = this.selectedCellIndex;
    const accessedCell = this.cellsAccessed[selectedCellIndex];
    if (!accessedCell || accessedCell.sheetId !== sheets.current) {
      this.marchingHighlight.clear();
      return;
    }

    const colorNumber = convertColorStringToTint(colors.cellHighlightColor[selectedCellIndex % NUM_OF_CELL_REF_COLORS]);

    // Clear once before drawing all ranges
    this.marchingHighlight.clear();

    // Draw marching highlight for all ranges, not just the first one
    accessedCell.ranges.forEach((range) => {
      const refRangeBounds = this.convertCellRefRangeToRefRangeBounds(range, this.isPython);
      if (refRangeBounds) {
        // Fill each range manually, then draw dashed lines with noFill to avoid clearing
        const selectionRect = getRangeScreenRectangleFromCellRefRange(refRangeBounds);
        const bounds = pixiApp.viewport.getVisibleBounds();
        if (intersects.rectangleRectangle(selectionRect, bounds)) {
          const boundedRight = Math.min(selectionRect.right, bounds.right);
          const boundedBottom = Math.min(selectionRect.bottom, bounds.bottom);

          // Fill the rectangle
          this.marchingHighlight.lineStyle({ alignment: 0.5 });
          this.marchingHighlight.beginFill(colorNumber, FILL_SELECTION_ALPHA);
          this.marchingHighlight.drawRect(
            selectionRect.left,
            selectionRect.top,
            boundedRight - selectionRect.left,
            boundedBottom - selectionRect.top
          );
          this.marchingHighlight.endFill();
        }

        // Draw dashed lines (noFill prevents clearing)
        drawDashedRectangleMarching({
          g: this.marchingHighlight,
          color: colorNumber,
          march: this.march,
          range: refRangeBounds,
          alpha: FILL_SELECTION_ALPHA,
          noFill: true,
        });
      }
    });

    this.march = (this.march + 1) % Math.floor(DASHED);
  };

  update = () => {
    // Update marching highlight first, before drawing static highlights
    // This ensures the marching pattern is ready before the viewport renders
    if (inlineEditorHandler.cursorIsMoving || !!this.cellsAccessed.length) {
      this.updateMarchingHighlight();
    }
    if (this.dirty) {
      this.dirty = false;
      this.draw();
      if (!inlineEditorHandler.cursorIsMoving && !this.cellsAccessed.length) {
        this.marchingHighlight.clear();
      }
    }
  };

  isDirty = (): boolean => {
    return this.dirty || inlineEditorHandler.cursorIsMoving || !!this.cellsAccessed.length;
  };

  fromCellsAccessed = (cellsAccessed: JsCellsAccessed[] | null, isPython: boolean) => {
    this.cellsAccessed = cellsAccessed ?? [];
    this.isPython = isPython;
    this.checkForInfiniteRanges();
    this.dirty = true;
  };

  setSelectedCell = (index: number) => {
    this.selectedCellIndex = index;
  };

  clearSelectedCell = () => {
    this.selectedCellIndex = undefined;
    this.marchingHighlight.clear();
  };
}
