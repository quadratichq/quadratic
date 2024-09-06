//! Draws both cell-based borders and sheet-based borders. The cell-based
//! borders are saved and culled during the update loop. The sheet-based borders
//! are always redrawn whenever the viewport changes.
//!
//! The logic in this is rather complicated as we need to remove overlapping
//! borders based on timestamps. For example, if you have a column with a left
//! border, before drawing that left border, you need to check if there are any
//! existing, visible cell-based, either left in that column, or right in the
//! previous column. You also need to check if there are any row-based borders
//! that have a left or right that would overlap the vertical line (and have a
//! later timestamp).
//!
//! Regrettably, you can't just draw over the border as they may be different
//! widths and this would remove any transparent background.

import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { Container, Rectangle, Sprite, Texture, TilingSprite } from 'pixi.js';
import { Sheet } from '../../../grid/sheet/Sheet';
import { CellsSheet } from '../CellsSheet';
import { BorderCull, drawCellBorder } from '../drawBorders';
import { BorderStyleCell, BorderStyleTimestamp, JsBordersSheet } from '@/app/quadratic-core-types';
import { pixiApp } from '../../pixiApp/PixiApp';
import { intersects } from '../../helpers/intersects';
import { divideLine, findPerpendicularHorizontalLines, findPerpendicularVerticalLines } from './bordersUtil';

// todo: probably want to centralize this with UIValidations
const MINIMUM_SCALE_TO_SHOW = 0.25;
const FADE_SCALE = 0.1;

export class Borders extends Container {
  private cellsSheet: CellsSheet;
  private cellLines: Container;
  private spriteLines: BorderCull[];

  private sheetLines: Container;
  private borders?: JsBordersSheet;

  dirty = false;

  constructor(cellsSheet: CellsSheet) {
    super();
    this.cellsSheet = cellsSheet;
    this.sheetLines = this.addChild(new Container());
    this.cellLines = this.addChild(new Container());
    this.spriteLines = [];

    events.on('bordersSheet', this.drawSheetCells);
    events.on('sheetOffsets', this.setDirty);
    events.on('resizeRowHeights', this.setDirty);
  }

  setDirty = () => (this.dirty = true);

  private get sheet(): Sheet {
    const sheet = sheets.getById(this.cellsSheet.sheetId);
    if (!sheet) throw new Error(`Expected sheet to be defined in CellsBorders.sheet`);
    return sheet;
  }

  // Draws a vertical line on the screen. This line may need to be split up if
  // there are borders already drawn.
  private drawScreenVerticalLine(
    rowStart: number,
    rowEnd: number,
    column: number,
    border: BorderStyleTimestamp,
    rows: Record<string, BorderStyleCell> | null
  ) {
    // break up the line if it overlaps with vertical lines
    const lines: [number, number][] = [];
    if (this.borders?.vertical || rows) {
      // filter the line and only include the ones that are visible
      const overlaps = this.borders?.vertical
        ? this.borders.vertical.filter(
            (vertical) =>
              Number(vertical.x) === column &&
              intersects.lineLineOneDimension(
                Number(vertical.y),
                Number(vertical.y + vertical.height),
                rowStart,
                rowEnd
              )
          )
        : [];
      overlaps.push(...findPerpendicularVerticalLines(rowStart, rowEnd, border.timestamp, rows));
      overlaps.sort((a, b) => Number(b.y) - Number(a.y));
      let current: number | undefined;
      while (overlaps.length) {
        const overlap = overlaps.pop();
        if (overlap) {
          current = divideLine(lines, current, rowStart, rowEnd, Number(overlap.y), Number(overlap.height));
        }
      }
      if (current === undefined) {
        lines.push([rowStart, rowEnd]);
      } else if (current < rowEnd) {
        lines.push([current, rowEnd]);
      }
    } else {
      lines.push([rowStart, rowEnd]);
    }
    const x = this.sheet.getColumnX(column);
    lines.forEach(([start, end]) => {
      const yStart = this.sheet.getRowY(start);
      const yEnd = this.sheet.getRowY(end);
      drawCellBorder({
        position: new Rectangle(x, yStart, 0, yEnd - yStart),
        vertical: { type: border.line, color: border.color },
        getSprite: this.getSpriteSheet,
      });
    });
  }

  // Draws a horizontal line on the screen. This line may need to be split up if
  // there are borders already drawn.
  private drawScreenHorizontalLine(
    columnStart: number,
    columnEnd: number,
    row: number,
    border: BorderStyleTimestamp,
    columns: Record<string, BorderStyleCell> | null
  ) {
    // break up the line if it overlaps with horizontal lines
    const lines: [number, number][] = [];
    if (this.borders?.horizontal || columns) {
      // filter the line and only include the ones that are visible
      const overlaps = this.borders?.horizontal
        ? this.borders.horizontal.filter(
            (horizontal) =>
              Number(horizontal.y) === row &&
              intersects.lineLineOneDimension(
                Number(horizontal.x),
                Number(horizontal.x + horizontal.width),
                columnStart,
                columnEnd
              )
          )
        : [];
      overlaps.push(...findPerpendicularHorizontalLines(columnStart, columnEnd, border.timestamp, columns));
      overlaps.sort((a, b) => Number(b.x) - Number(a.x));
      let current: number | undefined;
      while (overlaps.length) {
        const overlap = overlaps.pop();
        if (overlap) {
          current = divideLine(lines, current, columnStart, columnEnd, Number(overlap.x), Number(overlap.width));
        }
      }
      if (current === undefined) {
        lines.push([columnStart, columnEnd]);
      } else if (current < columnEnd) {
        lines.push([current, columnEnd]);
      }
    } else {
      lines.push([columnStart, columnEnd]);
    }
    const y = this.sheet.getRowY(row);
    lines.forEach(([start, end]) => {
      const xStart = this.sheet.getColumnX(start);
      const xEnd = this.sheet.getColumnX(end);
      drawCellBorder({
        position: new Rectangle(xStart, y, xEnd - xStart, 0),
        horizontal: { type: border.line, color: border.color },
        getSprite: this.getSpriteSheet,
      });
    });
  }

  // Takes the borders.all, .columns, and .rows, and then draws any borders
  // within the visible bounds.
  private drawSheetBorders() {
    this.sheetLines.removeChildren();
    const borders = this.borders;
    if (!borders || (!borders.all && !borders.columns && !borders.rows)) return;

    const bounds = pixiApp.viewport.getVisibleBounds();
    const offsets = sheets.sheet.offsets;

    const columnStart = offsets.getXPlacement(bounds.left);
    const columnEnd = offsets.getXPlacement(bounds.right);

    const rowStart = offsets.getYPlacement(bounds.top);
    const rowEnd = offsets.getYPlacement(bounds.bottom);

    if (borders.columns) {
      for (let x in borders.columns) {
        const xNumber = Number(BigInt(x));
        if (xNumber >= columnStart.index && xNumber <= columnEnd.index) {
          const column = borders.columns[x];
          if (column) {
            const left = column.left;
            if (left && left.line !== 'clear') {
              // need to ensure there's no right entry in x - 1
              const right = borders.columns[(xNumber - 1).toString()]?.right;
              if (!right || left.timestamp > right.timestamp) {
                this.drawScreenVerticalLine(rowStart.index, rowEnd.index + 1, xNumber, left, borders.rows);
              }
            }
            const right = column.right;
            if (right && right.line !== 'clear') {
              // need to ensure there's no left entry in x + 1
              const left = borders.columns[(xNumber + 1).toString()]?.left;
              if (!left || right.timestamp > left.timestamp) {
                this.drawScreenVerticalLine(rowStart.index, rowEnd.index + 1, xNumber + 1, right, borders.rows);
              }
            }
            const top = column.top;
            if (top && top.line !== 'clear') {
              for (let y = rowStart.index; y <= rowEnd.index + 1; y++) {
                this.drawScreenHorizontalLine(xNumber, xNumber + 1, y, top, null);
              }
            }
            const bottom = column.bottom;
            if (bottom && bottom.line !== 'clear') {
              for (let y = rowStart.index; y <= rowEnd.index + 1; y++) {
                this.drawScreenHorizontalLine(xNumber, xNumber + 1, y, bottom, null);
              }
            }
          }
        }
      }
    }

    if (borders.rows) {
      for (let y in borders.rows) {
        const yNumber = Number(BigInt(y));
        if (yNumber >= rowStart.index && yNumber <= rowEnd.index) {
          const row = borders.rows[y];
          if (row) {
            const top = row.top;
            if (top && top.line !== 'clear') {
              // need to ensure there's no bottom entry in y - 1
              const bottom = borders.rows[(yNumber - 1).toString()]?.bottom;
              if (!bottom || top.timestamp > bottom.timestamp) {
                this.drawScreenHorizontalLine(columnStart.index, columnEnd.index + 1, yNumber, top, borders.columns);
              }
            }
            const bottom = row.bottom;
            if (bottom && bottom.line !== 'clear') {
              // need to ensure there's no top entry in y + 1
              const top = borders.rows[(yNumber + 1).toString()]?.top;
              if (!top || bottom.timestamp > top.timestamp) {
                this.drawScreenHorizontalLine(
                  columnStart.index,
                  columnEnd.index + 1,
                  yNumber + 1,
                  bottom,
                  borders.columns
                );
              }
            }
            const left = row.left;
            if (left && left.line !== 'clear') {
              for (let x = columnStart.index; x <= columnEnd.index + 1; x++) {
                this.drawScreenVerticalLine(yNumber, yNumber + 1, x, left, null);
              }
            }
            const right = row.right;
            if (right && right.line !== 'clear') {
              for (let x = columnStart.index; x <= columnEnd.index + 1; x++) {
                this.drawScreenVerticalLine(yNumber, yNumber + 1, x, right, null);
              }
            }
          }
        }
      }
    }

    for (let row in borders.rows) {
      const rowNumber = Number(row);
      if (rowNumber >= rowStart.index && rowNumber <= rowEnd.index) {
      }
    }
  }

  private drawHorizontal() {
    if (!this.borders?.horizontal) return;
    for (const border of this.borders.horizontal) {
      const start = this.sheet.getCellOffsets(Number(border.x), Number(border.y));
      const end = this.sheet.getCellOffsets(Number(border.x + border.width), Number(border.y));
      const color = border.color;
      this.spriteLines.push(
        ...drawCellBorder({
          position: new Rectangle(start.x, start.y, end.x - start.x, end.y - start.y),
          horizontal: { type: border.line, color },
          getSprite: this.getSprite,
        })
      );
    }
  }

  private drawVertical() {
    if (!this.borders?.vertical) return;
    for (const border of this.borders.vertical) {
      const start = this.sheet.getCellOffsets(Number(border.x), Number(border.y));
      const end = this.sheet.getCellOffsets(Number(border.x), Number(border.y + border.height));
      const color = border.color;
      this.spriteLines.push(
        ...drawCellBorder({
          position: new Rectangle(start.x, start.y, end.x - start.x, end.y - start.y),
          vertical: { type: border.line, color },
          getSprite: this.getSprite,
        })
      );
    }
  }

  drawSheetCells = (sheetId: string, borders?: JsBordersSheet): void => {
    if (sheetId === this.cellsSheet.sheetId) {
      this.borders = borders;
      this.sheetLines.removeChildren();
      this.drawHorizontal();
      this.drawVertical();
      this.dirty = true;
    }
  };

  private cull() {
    const bounds = pixiApp.viewport.getVisibleBounds();
    this.spriteLines.forEach((sprite) => {
      sprite.sprite.visible = sprite.rectangle.intersects(bounds);
    });
  }

  update() {
    const viewportDirty = pixiApp.viewport.dirty;
    if (!this.dirty && !viewportDirty) return;
    if (pixiApp.viewport.scale.x < MINIMUM_SCALE_TO_SHOW) {
      this.visible = false;
      return;
    }
    if (pixiApp.viewport.scale.x < MINIMUM_SCALE_TO_SHOW + FADE_SCALE) {
      this.alpha = (pixiApp.viewport.scale.x - MINIMUM_SCALE_TO_SHOW) / FADE_SCALE;
    } else {
      this.alpha = 1;
    }
    this.visible = true;
    this.dirty = false;
    this.cull();
    this.drawSheetBorders();
  }

  private getSpriteSheet = (tiling?: boolean): Sprite | TilingSprite => {
    if (tiling) {
      return this.sheetLines.addChild(new TilingSprite(Texture.WHITE));
    } else {
      return this.sheetLines.addChild(new Sprite(Texture.WHITE));
    }
  };

  private getSprite = (tiling?: boolean): Sprite | TilingSprite => {
    if (tiling) {
      return this.cellLines.addChild(new TilingSprite(Texture.WHITE));
    } else {
      return this.cellLines.addChild(new Sprite(Texture.WHITE));
    }
  };
}
