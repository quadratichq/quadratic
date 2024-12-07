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
import { JsBorderHorizontal, JsBordersSheet, JsBorderVertical } from '@/app/quadratic-core-types';
import { Container, Rectangle, Sprite, Texture, TilingSprite } from 'pixi.js';
import { Sheet } from '../../grid/sheet/Sheet';
import { pixiApp } from '../pixiApp/PixiApp';
import { CellsSheet } from './CellsSheet';
import { BorderCull, drawCellBorder } from './drawBorders';

// this sets when to fade the sheet borders when (for performance reasons)
const SCALE_TO_SHOW_SHEET_BORDERS = 0.15;
const FADE_SCALE = 0.1;

export class Borders extends Container {
  private cellsSheet: CellsSheet;
  private cellLines: Container;
  private spriteLines: BorderCull[];

  private sheetLines: Container;
  private bordersFinite?: JsBordersSheet;
  private bordersInfinite?: JsBordersSheet;

  dirty = false;

  constructor(cellsSheet: CellsSheet) {
    super();
    this.cellsSheet = cellsSheet;
    this.sheetLines = this.addChild(new Container());
    this.cellLines = this.addChild(new Container());
    this.spriteLines = [];

    events.on('bordersSheet', this.drawSheetCells);
    events.on('sheetOffsets', this.setDirty);
  }

  destroy() {
    events.off('bordersSheet', this.drawSheetCells);
    events.off('sheetOffsets', this.setDirty);
    super.destroy();
  }

  setDirty = () => (this.dirty = true);

  private get sheet(): Sheet {
    const sheet = sheets.getById(this.cellsSheet.sheetId);
    if (!sheet) throw new Error(`Expected sheet to be defined in CellsBorders.sheet`);
    return sheet;
  }

  // private drawSheetBorders() {
  //   this.cellLines.removeChildren();
  //   this.sheetLines.removeChildren();

  //   pixiApp.viewport.dirty = true;

  //   const borders = this.borders;
  //   if (!borders) return;

  //   this.drawAll();
  //   this.drawHorizontal();
  //   this.drawVertical();

  //   const bounds = pixiApp.viewport.getVisibleBounds();
  //   const offsets = sheets.sheet.offsets;

  //   const columnStart = offsets.getXPlacement(bounds.left);
  //   const columnEnd = offsets.getXPlacement(bounds.right);

  //   const rowStart = offsets.getYPlacement(bounds.top);
  //   const rowEnd = offsets.getYPlacement(bounds.bottom);

  //   if (borders.columns) {
  //     for (let x in borders.columns) {
  //       const xNumber = Number(BigInt(x));
  //       if (xNumber >= columnStart.index && xNumber <= columnEnd.index) {
  //         const column = borders.columns[x];
  //         if (column) {
  //           const left = column.left;
  //           if (left && left.line !== 'clear') {
  //             // need to ensure there's no right entry in x - 1
  //             const right = borders.columns[(xNumber - 1).toString()]?.right;
  //             if (!right || left.timestamp > right.timestamp) {
  //               this.drawScreenVerticalLine(rowStart.index, rowEnd.index + 1, xNumber, left, borders.rows);
  //             }
  //           }
  //           const right = column.right;
  //           if (right && right.line !== 'clear') {
  //             // need to ensure there's no left entry in x + 1
  //             const left = borders.columns[(xNumber + 1).toString()]?.left;
  //             if (!left || right.timestamp > left.timestamp) {
  //               this.drawScreenVerticalLine(rowStart.index, rowEnd.index + 1, xNumber + 1, right, borders.rows);
  //             }
  //           }
  //           const top = column.top;
  //           if (top && top.line !== 'clear') {
  //             for (let y = rowStart.index; y <= rowEnd.index + 1; y++) {
  //               this.drawScreenHorizontalLine(xNumber, xNumber + 1, y, top, null);
  //             }
  //           }
  //           const bottom = column.bottom;
  //           if (bottom && bottom.line !== 'clear') {
  //             for (let y = rowStart.index; y <= rowEnd.index + 1; y++) {
  //               this.drawScreenHorizontalLine(xNumber, xNumber + 1, y, bottom, null);
  //             }
  //           }
  //         }
  //       }
  //     }
  //   }

  //   if (borders.rows) {
  //     for (let y in borders.rows) {
  //       const yNumber = Number(BigInt(y));
  //       if (yNumber >= rowStart.index && yNumber <= rowEnd.index) {
  //         const row = borders.rows[y];
  //         if (row) {
  //           const top = row.top;
  //           if (top && top.line !== 'clear') {
  //             // need to ensure there's no bottom entry in y - 1
  //             const bottom = borders.rows[(yNumber - 1).toString()]?.bottom;
  //             if (!bottom || top.timestamp > bottom.timestamp) {
  //               this.drawScreenHorizontalLine(columnStart.index, columnEnd.index + 1, yNumber, top, borders.columns);
  //             }
  //           }
  //           const bottom = row.bottom;
  //           if (bottom && bottom.line !== 'clear') {
  //             // need to ensure there's no top entry in y + 1
  //             const top = borders.rows[(yNumber + 1).toString()]?.top;
  //             if (!top || bottom.timestamp > top.timestamp) {
  //               this.drawScreenHorizontalLine(
  //                 columnStart.index,
  //                 columnEnd.index + 1,
  //                 yNumber + 1,
  //                 bottom,
  //                 borders.columns
  //               );
  //             }
  //           }
  //           const left = row.left;
  //           if (left && left.line !== 'clear') {
  //             for (let x = columnStart.index; x <= columnEnd.index + 1; x++) {
  //               this.drawScreenVerticalLine(yNumber, yNumber + 1, x, left, null);
  //             }
  //           }
  //           const right = row.right;
  //           if (right && right.line !== 'clear') {
  //             for (let x = columnStart.index; x <= columnEnd.index + 1; x++) {
  //               this.drawScreenVerticalLine(yNumber, yNumber + 1, x, right, null);
  //             }
  //           }
  //         }
  //       }
  //     }
  //   }
  // }

  private drawHorizontal(border: JsBorderHorizontal) {
    if (border.width !== null) {
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
    } else {
      // handle infinite...
    }
  }

  private drawVertical(border: JsBorderVertical) {
    if (border.height !== null) {
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
    } else {
      // handle infinite...
    }
  }

  drawSheetCells = (sheetId: string, borders?: JsBordersSheet): void => {
    console.log(borders);
    if (sheetId === this.cellsSheet.sheetId) {
      if (borders) {
        this.bordersFinite = {
          horizontal: borders.horizontal?.filter((border) => border.width !== null) || null,
          vertical: borders.vertical?.filter((border) => border.height !== null) || null,
        };
        this.bordersInfinite = {
          horizontal: borders.horizontal?.filter((border) => border.width === null) || null,
          vertical: borders.vertical?.filter((border) => border.height === null) || null,
        };
      }
      this.cellLines.removeChildren();
      this.bordersFinite?.horizontal?.forEach((border) => this.drawHorizontal(border));
      this.bordersFinite?.vertical?.forEach((border) => this.drawVertical(border));
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
    if (pixiApp.viewport.scale.x < SCALE_TO_SHOW_SHEET_BORDERS) {
      this.sheetLines.visible = false;
    } else {
      this.sheetLines.visible = true;
      this.bordersInfinite?.horizontal?.forEach((border) => this.drawHorizontal(border));
      this.bordersInfinite?.vertical?.forEach((border) => this.drawVertical(border));
      if (pixiApp.viewport.scale.x < SCALE_TO_SHOW_SHEET_BORDERS + FADE_SCALE) {
        this.sheetLines.alpha = (pixiApp.viewport.scale.x - SCALE_TO_SHOW_SHEET_BORDERS) / FADE_SCALE;
      } else {
        this.sheetLines.alpha = 1;
      }
    }
    this.dirty = false;
    this.cull();
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
