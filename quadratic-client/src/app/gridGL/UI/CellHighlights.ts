import { sheets } from '@/app/grid/controller/Sheets';
import { inlineEditorHandler } from '@/app/gridGL/HTMLGrid/inlineEditor/inlineEditorHandler';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { CURSOR_THICKNESS, CursorCell, FILL_ALPHA } from '@/app/gridGL/UI/Cursor';
import { colors } from '@/app/theme/colors';
import { Container, Graphics } from 'pixi.js';
import { convertColorStringToTint } from '../../helpers/convertColor';
import { DASHED, DASHED_THICKNESS, dashedTextures } from '../dashedTextures';

const NUM_OF_CELL_REF_COLORS = colors.cellHighlightColor.length;

const MARCH_ANIMATE_TIME_MS = 80;

export class CellHighlights extends Container {
  private highlights: Graphics;
  private marchingHighlight: Graphics;
  private march = 0;
  private marchLastTime = 0;

  dirty = false;

  constructor() {
    super();
    this.highlights = this.addChild(new Graphics());
    this.marchingHighlight = this.addChild(new Graphics());
  }

  private draw() {
    const highlightedCells = pixiApp.highlightedCells.getHighlightedCells();
    const highlightedCellIndex = pixiApp.highlightedCells.highlightedCellIndex;
    if (!highlightedCells.length) return;
    highlightedCells.forEach((cell, index) => {
      const colorNumber = convertColorStringToTint(colors.cellHighlightColor[cell.index % NUM_OF_CELL_REF_COLORS]);
      const cursorCell = sheets.sheet.getScreenRectangle(cell.column, cell.row, cell.width, cell.height);

      // We do not draw the dashed rectangle if the inline Formula editor's cell
      // cursor is moving (it's handled by updateMarchingHighlights instead).
      if (highlightedCellIndex === undefined || highlightedCellIndex !== index || !inlineEditorHandler.cursorIsMoving) {
        this.drawDashedRectangle(colorNumber, highlightedCellIndex === index, cursorCell);
      }
    });
    if (highlightedCells.length) {
      pixiApp.setViewportDirty();
    }
  }

  // Draws the marching highlights by using an offset dashed line to create the
  // marching effect.
  private updateMarchingHighlight() {
    if (this.marchLastTime === 0) {
      this.marchLastTime = Date.now();
    } else if (Date.now() - this.marchLastTime < MARCH_ANIMATE_TIME_MS) {
      return;
    } else {
      this.marchLastTime = Date.now();
    }
    const highlightedCell = pixiApp.highlightedCells.getSelectedHighlightedCell();
    if (!highlightedCell) {
      throw new Error('Expected highlightedCell to be defined in updateMarchingHighlight');
    }
    const colorNumber = convertColorStringToTint(
      colors.cellHighlightColor[highlightedCell.index % NUM_OF_CELL_REF_COLORS]
    );
    const cell = highlightedCell.cell;
    const cursorCell = sheets.sheet.getScreenRectangle(cell.column, cell.row, cell.width, cell.height);
    this.drawDashedRectangleMarching(colorNumber, cursorCell);
    this.march = (this.march + 1) % Math.floor(DASHED);
    pixiApp.setViewportDirty();
  }

  private drawDashedRectangleMarching(color: number, startCell: CursorCell) {
    const minX = startCell.x;
    const minY = startCell.y;
    const maxX = startCell.width + startCell.x;
    const maxY = startCell.y + startCell.height;

    const g = this.marchingHighlight;
    g.clear();

    g.lineStyle({
      alignment: 0,
    });
    g.moveTo(minX, minY);
    g.beginFill(color, FILL_ALPHA);
    g.drawRect(minX, minY, maxX - minX, maxY - minY);
    g.endFill();

    g.lineStyle({
      width: CURSOR_THICKNESS,
      color,
      alignment: 0,
    });

    const clamp = (n: number, min: number, max: number): number => {
      return Math.min(Math.max(n, min), max);
    };

    // This is a bit hacky of an algorithm to ensure the corners are squared and
    // never show less than DASHED_THICKNESS in size. The if statements are to
    // remove lines that are less than the DASHED_THICKNESS.

    let wrapAmount = 0;

    // draw top line
    for (let x = minX + this.march; x <= maxX - DASHED / 2; x += DASHED) {
      g.moveTo(clamp(x, minX, maxX), minY);
      g.lineTo(clamp(x + DASHED / 2, minX, maxX), minY);
      wrapAmount = x - (maxX - DASHED / 2);
    }

    // draw right line
    for (let y = minY + wrapAmount; y <= maxY - DASHED / 2; y += DASHED) {
      if (y + DASHED / 2 > minY + DASHED_THICKNESS) {
        g.moveTo(maxX, clamp(y, minY, maxY));
        g.lineTo(maxX, clamp(y + DASHED / 2, minY, maxY));
        wrapAmount = y + DASHED / 2 - maxY;
      }
    }

    // draw bottom line
    for (let x = maxX - wrapAmount; x >= minX + DASHED / 2; x -= DASHED) {
      if (x - DASHED / 2 < maxX - DASHED_THICKNESS) {
        g.moveTo(clamp(x - DASHED / 2, minX, maxX - DASHED_THICKNESS), maxY - DASHED_THICKNESS);
        g.lineTo(clamp(x, minX, maxX), maxY - DASHED_THICKNESS);
      }
      wrapAmount = minX - x - DASHED / 2;
    }

    // draw left line
    for (let y = maxY - wrapAmount; y >= minY + DASHED / 2; y -= DASHED) {
      g.moveTo(minX + DASHED_THICKNESS, clamp(y - DASHED / 2, minY, maxY));
      g.lineTo(minX + DASHED_THICKNESS, clamp(y, minY, maxY));
    }
  }

  private drawDashedRectangle(color: number, isSelected: boolean, startCell: CursorCell, endCell?: CursorCell) {
    const minX = Math.min(startCell.x, endCell?.x ?? Infinity);
    const minY = Math.min(startCell.y, endCell?.y ?? Infinity);
    const maxX = Math.max(startCell.width + startCell.x, endCell ? endCell.x + endCell.width : -Infinity);
    const maxY = Math.max(startCell.y + startCell.height, endCell ? endCell.y + endCell.height : -Infinity);

    const path = [
      [maxX, minY],
      [maxX, maxY],
      [minX, maxY],
      [minX, minY],
    ];

    const g = this.highlights;
    g.clear();

    // have to fill a rect because setting multiple line styles makes it unable to be filled
    if (isSelected) {
      g.lineStyle({
        alignment: 0,
      });
      g.moveTo(minX, minY);
      g.beginFill(color, FILL_ALPHA);
      g.drawRect(minX, minY, maxX - minX, maxY - minY);
      g.endFill();
    }

    g.moveTo(minX, minY);
    for (let i = 0; i < path.length; i++) {
      const texture = i % 2 === 0 ? dashedTextures.dashedHorizontal : dashedTextures.dashedVertical;
      g.lineStyle({
        width: CURSOR_THICKNESS,
        color,
        alignment: 0,
        texture,
      });
      g.lineTo(path[i][0], path[i][1]);
    }
  }

  update() {
    if (this.dirty) {
      this.dirty = false;
      this.draw();
      // this.marchingHighlight.clear();
      // this.marchLastTime = 0;
    }

    if (inlineEditorHandler.cursorIsMoving) {
      this.updateMarchingHighlight();
    }
  }

  isDirty() {
    return this.dirty || inlineEditorHandler.cursorIsMoving;
  }
}
