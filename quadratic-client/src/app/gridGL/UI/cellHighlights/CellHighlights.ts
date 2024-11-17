import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { DASHED } from '@/app/gridGL/generateTextures';
import { inlineEditorHandler } from '@/app/gridGL/HTMLGrid/inlineEditor/inlineEditorHandler';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { Coordinate } from '@/app/gridGL/types/size';
import { drawDashedRectangle, drawDashedRectangleMarching } from '@/app/gridGL/UI/cellHighlights/cellHighlightsDraw';
import { convertColorStringToTint } from '@/app/helpers/convertColor';
import { CellPosition, ParseFormulaReturnType, Span } from '@/app/helpers/formulaNotation';
import { JsCellsAccessed } from '@/app/quadratic-core-types';
import { colors } from '@/app/theme/colors';
import { Container, Graphics } from 'pixi.js';

// TODO: these files need to be cleaned up and properly typed. Lots of untyped
// data passed around within the data.

export interface HighlightedCellRange {
  column: number;
  row: number;
  width: number;
  height: number;
  span: Span;
  sheet: string;
  index: number;
}

export interface HighlightedCell {
  column: number;
  row: number;
  sheet: string;
}

const NUM_OF_CELL_REF_COLORS = colors.cellHighlightColor.length;
const MARCH_ANIMATE_TIME_MS = 80;

export class CellHighlights extends Container {
  private highlightedCells: HighlightedCellRange[] = [];
  highlightedCellIndex: number | undefined;

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
    this.highlightedCells = [];
    this.highlightedCellIndex = undefined;
    this.highlights.clear();
    this.marchingHighlight.clear();
    pixiApp.setViewportDirty();
    this.dirty = false;
  }

  private draw() {
    this.highlights.clear();
    const highlightedCells = [...this.highlightedCells];
    const highlightedCellIndex = this.highlightedCellIndex;
    if (!highlightedCells.length) return;
    highlightedCells.forEach((cell, index) => {
      if (cell.sheet !== sheets.sheet.id) return;

      const colorNumber = convertColorStringToTint(colors.cellHighlightColor[cell.index % NUM_OF_CELL_REF_COLORS]);
      const cursorCell = sheets.sheet.getScreenRectangle(cell.column, cell.row, cell.width, cell.height);

      // We do not draw the dashed rectangle if the inline Formula editor's cell
      // cursor is moving (it's handled by updateMarchingHighlights instead).
      if (highlightedCellIndex === undefined || highlightedCellIndex !== index || !inlineEditorHandler.cursorIsMoving) {
        drawDashedRectangle({
          g: this.highlights,
          color: colorNumber,
          isSelected: highlightedCellIndex === index,
          startCell: cursorCell,
        });
      }
    });
    if (highlightedCells.length) {
      pixiApp.setViewportDirty();
    }
  }

  // Draws the marching highlights by using an offset dashed line to create the
  // marching effect.
  private updateMarchingHighlight() {
    if (!inlineEditorHandler.cursorIsMoving) {
      this.highlightedCellIndex = undefined;
      return;
    }
    // Index may not have been set yet.
    if (this.highlightedCellIndex === undefined) return;
    if (this.marchLastTime === 0) {
      this.marchLastTime = Date.now();
    } else if (Date.now() - this.marchLastTime < MARCH_ANIMATE_TIME_MS) {
      return;
    } else {
      this.marchLastTime = Date.now();
    }
    const highlightedCell = this.highlightedCells[this.highlightedCellIndex];
    if (!highlightedCell) return;
    const colorNumber = convertColorStringToTint(
      colors.cellHighlightColor[highlightedCell.index % NUM_OF_CELL_REF_COLORS]
    );
    const cursorCell = sheets.sheet.getScreenRectangle(
      highlightedCell.column,
      highlightedCell.row,
      highlightedCell.width,
      highlightedCell.height
    );
    drawDashedRectangleMarching(this.marchingHighlight, colorNumber, cursorCell, this.march);
    this.march = (this.march + 1) % Math.floor(DASHED);
    pixiApp.setViewportDirty();
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

  private getSheet(cellSheet: string | undefined, sheetId: string): string {
    if (!cellSheet) return sheetId;

    // It may come in as either a sheet id or a sheet name.
    if (sheets.getById(cellSheet)) {
      return cellSheet;
    }
    return sheets.getSheetByName(cellSheet)?.id ?? sheetId;
  }

  evalCoord(cell: { type: 'Relative' | 'Absolute'; coord: number }, origin: number) {
    const isRelative = cell.type === 'Relative';
    const getOrigin = isRelative ? origin : 0;

    return getOrigin + cell.coord;
  }

  private fromCellRange(
    cellRange: { type: 'CellRange'; start: CellPosition; end: CellPosition; sheet?: string },
    origin: Coordinate,
    sheet: string,
    span: Span,
    index: number
  ) {
    const startX = this.evalCoord(cellRange.start.x, origin.x);
    const startY = this.evalCoord(cellRange.start.y, origin.y);
    const endX = this.evalCoord(cellRange.end.x, origin.x);
    const endY = this.evalCoord(cellRange.end.y, origin.y);
    this.highlightedCells.push({
      column: startX,
      row: startY,
      width: endX - startX,
      height: endY - startY,
      sheet: this.getSheet(cellRange.sheet ?? cellRange.start.sheet, sheet),
      span,
      index,
    });
  }

  private fromCell(cell: CellPosition, origin: Coordinate, sheet: string, span: Span, index: number) {
    this.highlightedCells.push({
      column: this.evalCoord(cell.x, origin.x),
      row: this.evalCoord(cell.y, origin.y),
      width: 0,
      height: 0,
      sheet: this.getSheet(cell.sheet, sheet),
      span,
      index,
    });
  }

  fromFormula(formula: ParseFormulaReturnType, cell: Coordinate, sheet: string) {
    this.highlightedCells = [];

    formula.cell_refs.forEach((cellRef, index) => {
      switch (cellRef.cell_ref.type) {
        case 'CellRange':
          this.fromCellRange(cellRef.cell_ref, cell, sheet, cellRef.span, index);
          break;

        case 'Cell':
          this.fromCell(cellRef.cell_ref.pos, cell, sheet, cellRef.span, index);
          break;

        default:
          throw new Error('Unsupported cell-ref in fromFormula');
      }
    });
    pixiApp.cellHighlights.dirty = true;
  }

  fromCellsAccessed(cellsAccessed: JsCellsAccessed, cell: Coordinate, sheet: string) {
    this.highlightedCells = [];
    for (const sheetId in cellsAccessed.cells) {
      if (sheetId === sheet) {
        cellsAccessed.cells[sheetId].forEach((cell: any) => {
          throw new Error('todo');
        });
      }
    }
    pixiApp.cellHighlights.dirty = true;
  }

  setHighlightedCell(index: number) {
    this.highlightedCellIndex = this.highlightedCells.findIndex((cell) => cell.index === index);
  }

  getHighlightedCells() {
    return this.highlightedCells;
  }

  clearHighlightedCell() {
    this.highlightedCellIndex = undefined;
    this.marchingHighlight.clear();
  }
}
