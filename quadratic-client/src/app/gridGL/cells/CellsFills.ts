import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import type { Sheet } from '@/app/grid/sheet/Sheet';
import type { CellsSheet } from '@/app/gridGL/cells/CellsSheet';
import { intersects } from '@/app/gridGL/helpers/intersects';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { convertColorStringToTint, getCSSVariableTint } from '@/app/helpers/convertColor';
import type { JsRenderCodeCell, JsRenderFill, JsSheetFill } from '@/app/quadratic-core-types';
import { colors } from '@/app/theme/colors';
import { Container, Graphics, ParticleContainer, Rectangle, Sprite, Texture } from 'pixi.js';

interface SpriteBounds extends Sprite {
  viewBounds: Rectangle;
}

// TODO: (jimniels) this doesn't match the table header and also doesn't match
// the theme. The problem here is that a table cell might have a background
// of orange, which is why this is a solid color with lightened opacity.
// We should figure out how to make this better match the theme and light/dark mode
const ALTERNATING_BG_OPACITY = 0.035;
const ALTERNATING_BG_COLOR = getCSSVariableTint('text');

export class CellsFills extends Container {
  private cellsSheet: CellsSheet;
  private cells: JsRenderFill[] = [];
  private sheetFills?: JsSheetFill[];
  private alternatingColorsGraphics: Graphics;

  private cellsContainer: ParticleContainer;
  private meta: Graphics;
  private alternatingColors: Map<string, JsRenderCodeCell> = new Map();

  private dirty = false;
  private dirtyTables = false;

  constructor(cellsSheet: CellsSheet) {
    super();
    this.cellsSheet = cellsSheet;
    this.meta = this.addChild(new Graphics());
    this.cellsContainer = this.addChild(
      new ParticleContainer(undefined, { vertices: true, tint: true }, undefined, true)
    );
    this.alternatingColorsGraphics = this.addChild(new Graphics());

    events.on('sheetFills', this.handleSheetFills);
    events.on('sheetMetaFills', this.handleSheetMetaFills);
    events.on('sheetOffsetsUpdated', this.drawSheetCells);
    events.on('cursorPosition', this.setDirty);
    events.on('resizeHeadingColumn', this.drawCells);
    events.on('resizeHeadingColumn', this.drawSheetCells);
    events.on('resizeHeadingRow', this.drawCells);
    events.on('resizeHeadingRow', this.drawSheetCells);
    events.on('viewportChanged', this.setDirty);
  }

  destroy() {
    events.off('sheetFills', this.handleSheetFills);
    events.off('sheetMetaFills', this.handleSheetMetaFills);
    events.off('sheetOffsetsUpdated', this.drawSheetCells);
    events.off('cursorPosition', this.setDirty);
    events.off('resizeHeadingColumn', this.drawCells);
    events.off('resizeHeadingColumn', this.drawSheetCells);
    events.off('resizeHeadingRow', this.drawCells);
    events.off('resizeHeadingRow', this.drawSheetCells);
    events.off('viewportChanged', this.setDirty);
    super.destroy();
  }

  private handleSheetFills = (sheetId: string, fills: JsRenderFill[]) => {
    if (sheetId === this.cellsSheet.sheetId) {
      this.cells = fills;
      this.drawCells();
    }
  };

  private handleSheetMetaFills = (sheetId: string, fills: JsSheetFill[]) => {
    if (sheetId === this.cellsSheet.sheetId) {
      if (fills.length === 0) {
        this.sheetFills = undefined;
        this.meta.clear();
        pixiApp.setViewportDirty();
      } else {
        this.sheetFills = fills;
        this.setDirty();
      }
    }
  };

  setDirty = () => {
    this.dirty = true;
  };

  cheapCull = (viewBounds: Rectangle) => {
    this.cellsContainer.children.forEach(
      (sprite) => (sprite.visible = intersects.rectangleRectangle(viewBounds, (sprite as SpriteBounds).viewBounds))
    );
  };

  private getColor(color: string): number {
    if (color === 'blank') {
      return colors.gridBackground;
    } else {
      return convertColorStringToTint(color);
    }
  }

  private get sheet(): Sheet {
    const sheet = sheets.getById(this.cellsSheet.sheetId);
    if (!sheet) throw new Error(`Expected sheet to be defined in CellsFills.sheet`);
    return sheet;
  }

  private drawCells = () => {
    this.cellsContainer.removeChildren();
    const renderedRects = new Set<string>();

    this.cells.forEach((fill) => {
      // Collect all merged cells that intersect with this fill rectangle
      const mergedCells = new Map<string, { x: number; y: number; w: number; h: number }>();
      const fillRight = Number(fill.x) + fill.w - 1;
      const fillBottom = Number(fill.y) + fill.h - 1;

      // Check each cell in the fill rectangle for merged cells
      for (let y = Number(fill.y); y <= fillBottom; y++) {
        for (let x = Number(fill.x); x <= fillRight; x++) {
          const mergeRect = this.sheet.getMergeCellRect(x, y);
          if (mergeRect) {
            const mergeKey = `${mergeRect.min.x},${mergeRect.min.y}`;
            if (!mergedCells.has(mergeKey)) {
              mergedCells.set(mergeKey, {
                x: Number(mergeRect.min.x),
                y: Number(mergeRect.min.y),
                w: Number(mergeRect.max.x) - Number(mergeRect.min.x) + 1,
                h: Number(mergeRect.max.y) - Number(mergeRect.min.y) + 1,
              });
            }
          }
        }
      }

      // If this fill intersects with merged cells, render each merged cell
      if (mergedCells.size > 0) {
        mergedCells.forEach((mergedCell, mergeKey) => {
          // Skip if we've already rendered this merged cell with this color
          const rectKey = `${mergeKey},${fill.color}`;
          if (renderedRects.has(rectKey)) {
            return;
          }
          renderedRects.add(rectKey);

          const sprite = this.cellsContainer.addChild(new Sprite(Texture.WHITE)) as SpriteBounds;
          sprite.tint = this.getColor(fill.color);
          const screen = this.sheet.getScreenRectangle(mergedCell.x, mergedCell.y, mergedCell.w, mergedCell.h);
          sprite.position.set(screen.x, screen.y);
          sprite.width = screen.width;
          sprite.height = screen.height;
          sprite.viewBounds = new Rectangle(screen.x, screen.y, screen.width + 1, screen.height + 1);
        });
      } else {
        // No merged cells, render the fill as-is
        const sprite = this.cellsContainer.addChild(new Sprite(Texture.WHITE)) as SpriteBounds;
        sprite.tint = this.getColor(fill.color);
        const screen = this.sheet.getScreenRectangle(Number(fill.x), Number(fill.y), fill.w, fill.h);
        sprite.position.set(screen.x, screen.y);
        sprite.width = screen.width;
        sprite.height = screen.height;
        sprite.viewBounds = new Rectangle(screen.x, screen.y, screen.width + 1, screen.height + 1);
      }
    });
    pixiApp.setViewportDirty();
  };

  private drawSheetCells = (sheetId: string) => {
    if (sheetId === this.cellsSheet.sheetId) {
      this.drawCells();
    }
  };

  update = () => {
    if (this.dirty) {
      this.dirty = false;
      this.drawMeta();
    }
    if (this.dirtyTables) {
      this.dirtyTables = false;
      this.drawAlternatingColors();
    }
  };

  private drawMeta = () => {
    if (this.sheetFills) {
      this.meta.clear();
      const viewport = pixiApp.viewport.getVisibleBounds();
      this.sheetFills.forEach((fill) => {
        const offset = this.sheet.getCellOffsets(fill.x, fill.y);
        if (offset.x > viewport.right || offset.y > viewport.bottom) return;

        // infinite sheet
        if (fill.w == null && fill.h == null) {
          this.meta.beginFill(this.getColor(fill.color));
          const x = Math.max(offset.x, viewport.left);
          const y = Math.max(offset.y, viewport.top);
          this.meta.drawRect(
            x,
            y,
            viewport.width - (offset.x - viewport.left),
            viewport.height - (offset.y - viewport.top)
          );
          this.meta.endFill();
        }

        // infinite column
        else if (fill.h == null && fill.w != null) {
          this.meta.beginFill(this.getColor(fill.color));
          const startX = Math.max(offset.x, viewport.left);
          const startY = Math.max(offset.y, viewport.top);
          const end = this.sheet.offsets.getColumnPlacement(Number(fill.x) + Number(fill.w));
          let endX = end.position;
          endX = Math.min(endX, viewport.right);
          this.meta.drawRect(startX, startY, endX - startX, viewport.height - (startY - viewport.top));
          this.meta.endFill();
        }

        // infinite row
        else if (fill.w == null && fill.h != null) {
          this.meta.beginFill(this.getColor(fill.color));
          const startX = Math.max(offset.x, viewport.left);
          const startY = Math.max(offset.y, viewport.top);
          const end = this.sheet.offsets.getRowPlacement(Number(fill.y) + Number(fill.h));
          let endY = end.position;
          endY = Math.min(endY, viewport.bottom);
          this.meta.drawRect(startX, startY, viewport.width - (startX - viewport.left), endY - startY);
          this.meta.endFill();
        }
      });
      pixiApp.setViewportDirty();
    }
  };

  // this is called by Table.ts
  updateAlternatingColors = (x: number, y: number, table?: JsRenderCodeCell) => {
    const key = `${x},${y}`;
    if (table && table.h > 1 && table.alternating_colors && !table.is_html_image) {
      this.alternatingColors.set(key, table);
      this.dirtyTables = true;
    } else {
      if (this.alternatingColors.has(key)) {
        this.alternatingColors.delete(key);
        this.dirtyTables = true;
      }
    }
  };

  private drawAlternatingColors = () => {
    this.alternatingColorsGraphics.clear();
    this.alternatingColors.forEach((table) => {
      const bounds = this.sheet.getScreenRectangle(table.x, table.y, table.w, table.y);
      let yOffset = bounds.y;
      for (let y = 0; y < table.h; y++) {
        let height = this.sheet.offsets.getRowHeight(y + table.y);
        if (y % 2 !== (table.show_name !== table.show_columns ? 1 : 0)) {
          this.alternatingColorsGraphics.beginFill(ALTERNATING_BG_COLOR, ALTERNATING_BG_OPACITY);
          this.alternatingColorsGraphics.drawRect(bounds.x, yOffset, bounds.width, height);
          this.alternatingColorsGraphics.endFill();
        }
        yOffset += height;
      }
    });
    pixiApp.setViewportDirty();
  };
}
