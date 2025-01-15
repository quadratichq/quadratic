import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { DASHED } from '@/app/gridGL/generateTextures';
import { inlineEditorHandler } from '@/app/gridGL/HTMLGrid/inlineEditor/inlineEditorHandler';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { drawDashedRectangle, drawDashedRectangleMarching } from '@/app/gridGL/UI/cellHighlights/cellHighlightsDraw';
import { convertColorStringToTint } from '@/app/helpers/convertColor';
import type { JsCellsAccessed } from '@/app/quadratic-core-types';
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

  dirty = false;

  constructor() {
    super();
    this.highlights = this.addChild(new Graphics());
    this.marchingHighlight = this.addChild(new Graphics());
    events.on('changeSheet', this.setDirty);
  }

  destroy() {
    events.off('changeSheet', this.setDirty);
    super.destroy();
  }

  setDirty = () => {
    this.dirty = true;
  };

  clear() {
    this.cellsAccessed = [];
    this.selectedCellIndex = undefined;
    this.highlights.clear();
    this.marchingHighlight.clear();
    pixiApp.setViewportDirty();
    this.dirty = false;
  }

  private draw() {
    this.highlights.clear();

    if (!this.cellsAccessed.length) return;

    const selectedCellIndex = this.selectedCellIndex;

    const cellsAccessed = [...this.cellsAccessed];
    cellsAccessed
      .filter(({ sheetId }) => sheetId === sheets.current)
      .flatMap(({ ranges }) => ranges)
      .forEach((range, index) => {
        if (selectedCellIndex === undefined || selectedCellIndex !== index || !inlineEditorHandler.cursorIsMoving) {
          drawDashedRectangle({
            g: this.highlights,
            color: convertColorStringToTint(colors.cellHighlightColor[index % NUM_OF_CELL_REF_COLORS]),
            isSelected: selectedCellIndex === index,
            range,
          });
        }
      });

    pixiApp.setViewportDirty();
  }

  // Draws the marching highlights by using an offset dashed line to create the
  // marching effect.
  private updateMarchingHighlight() {
    if (!inlineEditorHandler.cursorIsMoving) {
      this.selectedCellIndex = undefined;
      return;
    }
    // Index may not have been set yet.
    if (this.selectedCellIndex === undefined) return;
    if (this.marchLastTime === 0) {
      this.marchLastTime = Date.now();
    } else if (Date.now() - this.marchLastTime < MARCH_ANIMATE_TIME_MS) {
      return;
    } else {
      this.marchLastTime = Date.now();
    }
    const selectedCellIndex = this.selectedCellIndex;
    const accessedCell = this.cellsAccessed[selectedCellIndex];
    if (!accessedCell) return;
    const colorNumber = convertColorStringToTint(colors.cellHighlightColor[selectedCellIndex % NUM_OF_CELL_REF_COLORS]);
    const render = drawDashedRectangleMarching({
      g: this.marchingHighlight,
      color: colorNumber,
      march: this.march,
      range: accessedCell.ranges[0],
    });
    this.march = (this.march + 1) % Math.floor(DASHED);
    if (render) {
      pixiApp.setViewportDirty();
    }
  }

  update() {
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
  }

  isDirty() {
    return this.dirty || inlineEditorHandler.cursorIsMoving;
  }

  evalCoord(cell: { type: 'Relative' | 'Absolute'; coord: number }, origin: number) {
    const isRelative = cell.type === 'Relative';
    const getOrigin = isRelative ? origin : 0;

    return getOrigin + cell.coord;
  }

  fromCellsAccessed(cellsAccessed: JsCellsAccessed[] | null) {
    this.cellsAccessed = cellsAccessed ?? [];
    pixiApp.cellHighlights.dirty = true;
  }

  setSelectedCell(index: number) {
    this.selectedCellIndex = index;
  }

  clearSelectedCell() {
    this.selectedCellIndex = undefined;
    this.marchingHighlight.clear();
  }
}
