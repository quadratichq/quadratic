import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { DASHED } from '@/app/gridGL/generateTextures';
import { inlineEditorHandler } from '@/app/gridGL/HTMLGrid/inlineEditor/inlineEditorHandler';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { drawDashedRectangle, drawDashedRectangleMarching } from '@/app/gridGL/UI/cellHighlights/cellHighlightsDraw';
import { FILL_SELECTION_ALPHA } from '@/app/gridGL/UI/Cursor';
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

  private draw = () => {
    this.highlights.clear();

    if (!this.cellsAccessed.length) return;

    this.cellsAccessed.forEach(({ sheetId, ranges }, index) => {
      if (sheetId !== sheets.current) return;

      // don't redraw any marching ants highlights
      if (inlineEditorHandler.cursorIsMoving && index === this.selectedCellIndex) return;

      ranges.forEach((range, i) => {
        const refRangeBounds = this.convertCellRefRangeToRefRangeBounds(range, this.isPython);
        if (refRangeBounds) {
          drawDashedRectangle({
            g: this.highlights,
            color: convertColorStringToTint(colors.cellHighlightColor[index % NUM_OF_CELL_REF_COLORS]),
            isSelected: this.selectedCellIndex === index,
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
    if (!inlineEditorHandler.cursorIsMoving) {
      this.marchingHighlight.clear();
      this.selectedCellIndex = undefined;
      return;
    }

    // Index may not have been set yet.
    if (this.selectedCellIndex === undefined) {
      this.marchingHighlight.clear();
      return;
    }

    if (this.marchLastTime === 0) {
      this.marchLastTime = Date.now();
    } else if (Date.now() - this.marchLastTime < MARCH_ANIMATE_TIME_MS) {
      return;
    } else {
      this.marchLastTime = Date.now();
    }

    const selectedCellIndex = this.selectedCellIndex;
    const accessedCell = this.cellsAccessed[selectedCellIndex];
    if (!accessedCell || accessedCell.sheetId !== sheets.current) {
      this.marchingHighlight.clear();
      return;
    }

    const colorNumber = convertColorStringToTint(colors.cellHighlightColor[selectedCellIndex % NUM_OF_CELL_REF_COLORS]);
    const refRangeBounds = this.convertCellRefRangeToRefRangeBounds(accessedCell.ranges[0], this.isPython);
    if (!refRangeBounds) {
      this.marchingHighlight.clear();
      return;
    }

    drawDashedRectangleMarching({
      g: this.marchingHighlight,
      color: colorNumber,
      march: this.march,
      range: refRangeBounds,
      alpha: FILL_SELECTION_ALPHA,
    });
    this.march = (this.march + 1) % Math.floor(DASHED);
  };

  update = () => {
    if (this.dirty) {
      this.dirty = false;
      this.draw();
      if (!inlineEditorHandler.cursorIsMoving) {
        this.marchingHighlight.clear();
      }
    }

    if (inlineEditorHandler.cursorIsMoving) {
      this.updateMarchingHighlight();
    }
  };

  isDirty = () => {
    return this.dirty || inlineEditorHandler.cursorIsMoving;
  };

  fromCellsAccessed = (cellsAccessed: JsCellsAccessed[] | null, isPython: boolean) => {
    this.cellsAccessed = cellsAccessed ?? [];
    this.isPython = isPython;
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
