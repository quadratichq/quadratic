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
import type { Sheet } from '@/app/grid/sheet/Sheet';
import type { CellsSheet } from '@/app/gridGL/cells/CellsSheet';
import type { BorderCull } from '@/app/gridGL/cells/drawBorders';
import { drawCellBorder } from '@/app/gridGL/cells/drawBorders';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import type { JsBorderHorizontal, JsBordersSheet, JsBorderVertical } from '@/app/quadratic-core-types';
import { Container, Rectangle, Sprite, Texture, TilingSprite } from 'pixi.js';

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
    events.on('sheetOffsetsUpdated', this.sheetOffsetsChanged);
    events.on('resizeHeadingColumn', this.sheetOffsetsChanged);
    events.on('resizeHeadingRow', this.sheetOffsetsChanged);
  }

  destroy() {
    events.off('bordersSheet', this.drawSheetCells);
    events.off('sheetOffsetsUpdated', this.sheetOffsetsChanged);
    events.off('resizeHeadingColumn', this.sheetOffsetsChanged);
    events.off('resizeHeadingRow', this.sheetOffsetsChanged);
    super.destroy();
  }

  private sheetOffsetsChanged = (sheetId: string) => {
    if (sheetId === this.cellsSheet.sheetId) {
      this.draw();
      this.dirty = true;
    }
  };

  private get sheet(): Sheet {
    const sheet = sheets.getById(this.cellsSheet.sheetId);
    if (!sheet) throw new Error(`Expected sheet to be defined in CellsBorders.sheet`);
    return sheet;
  }

  // Draws horizontal border and returns the y offset of the current border
  private drawHorizontal = (border: JsBorderHorizontal, bounds: Rectangle): number => {
    if (border.width !== null) {
      const start = this.sheet.getCellOffsets(Number(border.x), Number(border.y));
      const end = this.sheet.getCellOffsets(Number(border.x + border.width), Number(border.y));
      const color = border.color;
      this.spriteLines.push(
        ...drawCellBorder({
          position: new Rectangle(start.x, start.y, end.x - start.x, end.y - start.y),
          horizontal: { type: border.line, color },
          getSprite: border.unbounded ? this.getSpriteSheet : this.getSprite,
        })
      );
      return end.y;
    } else {
      const start = this.sheet.getCellOffsets(Number(border.x), Number(border.y));
      const xStart = Math.max(start.x, bounds.left);
      const xEnd = bounds.right;
      const yStart = Math.max(start.y, bounds.top);
      if (yStart > bounds.bottom || yStart < bounds.top || xStart > bounds.right) return Infinity;
      drawCellBorder({
        position: new Rectangle(xStart, yStart, xEnd - xStart, 0),
        horizontal: { type: border.line, color: border.color },
        getSprite: this.getSpriteSheet,
      });
      return yStart;
    }
  };

  // Draws vertical border and returns the x offset of the current border
  private drawVertical = (border: JsBorderVertical, bounds: Rectangle): number => {
    if (border.height !== null) {
      const start = this.sheet.getCellOffsets(Number(border.x), Number(border.y));
      const end = this.sheet.getCellOffsets(Number(border.x), Number(border.y + border.height));
      this.spriteLines.push(
        ...drawCellBorder({
          position: new Rectangle(start.x, start.y, end.x - start.x, end.y - start.y),
          vertical: { type: border.line, color: border.color },
          getSprite: border.unbounded ? this.getSpriteSheet : this.getSprite,
        })
      );
      return end.x;
    } else {
      const start = this.sheet.getCellOffsets(Number(border.x), Number(border.y));
      const xStart = Math.max(start.x, bounds.left);
      const yStart = Math.max(start.y, bounds.top);
      const yEnd = bounds.bottom;
      if (xStart > bounds.right || xStart < bounds.left || yStart > bounds.bottom) return Infinity;
      drawCellBorder({
        position: new Rectangle(xStart, yStart, 0, yEnd - yStart),
        vertical: { type: border.line, color: border.color },
        getSprite: this.getSpriteSheet,
      });
      return xStart;
    }
  };

  private drawSheetCells = (sheetId: string, borders: JsBordersSheet): void => {
    if (sheetId === this.cellsSheet.sheetId) {
      this.bordersFinite = {
        horizontal: borders.horizontal?.filter((border) => border.width !== null && !border.unbounded) || null,
        vertical: borders.vertical?.filter((border) => border.height !== null && !border.unbounded) || null,
      };
      this.bordersInfinite = {
        horizontal: borders.horizontal?.filter((border) => border.width === null || border.unbounded) || null,
        vertical: borders.vertical?.filter((border) => border.height === null || border.unbounded) || null,
      };
      this.draw();
      this.dirty = true;
    }
  };

  private draw = () => {
    this.cellLines.removeChildren();
    const bounds = pixiApp.viewport.getVisibleBounds();
    this.bordersFinite?.horizontal?.forEach((border) => this.drawHorizontal(border, bounds));
    this.bordersFinite?.vertical?.forEach((border) => this.drawVertical(border, bounds));
  };

  private cull = () => {
    const bounds = pixiApp.viewport.getVisibleBounds();
    this.spriteLines.forEach((sprite) => {
      sprite.sprite.visible = sprite.rectangle.intersects(bounds);
    });
  };

  update = () => {
    const viewportDirty = pixiApp.viewport.dirty;
    if (!this.dirty && !viewportDirty) return;
    if (pixiApp.viewport.scale.x < SCALE_TO_SHOW_SHEET_BORDERS) {
      this.sheetLines.visible = false;
    } else {
      this.sheetLines.removeChildren();
      this.sheetLines.visible = true;
      const bounds = pixiApp.viewport.getVisibleBounds();
      this.bordersInfinite?.horizontal?.forEach((border) => {
        if (border.unbounded) {
          let yOffset = 0,
            y = border.y;
          while (yOffset < bounds.bottom) {
            yOffset = this.drawHorizontal({ ...border, y }, bounds);
            y++;
          }
        } else {
          this.drawHorizontal(border, bounds);
        }
      });
      this.bordersInfinite?.vertical?.forEach((border) => {
        if (border.unbounded) {
          let xOffset = 0,
            x = border.x;
          while (xOffset < bounds.right) {
            xOffset = this.drawVertical({ ...border, x }, bounds);
            x++;
          }
        } else {
          this.drawVertical(border, bounds);
        }
      });
      if (pixiApp.viewport.scale.x < SCALE_TO_SHOW_SHEET_BORDERS + FADE_SCALE) {
        this.sheetLines.alpha = (pixiApp.viewport.scale.x - SCALE_TO_SHOW_SHEET_BORDERS) / FADE_SCALE;
      } else {
        this.sheetLines.alpha = 1;
      }
      pixiApp.setViewportDirty();
    }
    this.dirty = false;
    this.cull();
  };

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
