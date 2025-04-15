import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import type { Sheet } from '@/app/grid/sheet/Sheet';
import type { CellsSheet } from '@/app/gridGL/cells/CellsSheet';
import { intersects } from '@/app/gridGL/helpers/intersects';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { convertColorStringToTint, getCSSVariableTint } from '@/app/helpers/convertColor';
import type { JsRenderCodeCell, JsRenderFill, JsSheetFill } from '@/app/quadratic-core-types';
import { colors } from '@/app/theme/colors';
import type { IParticle } from 'pixi.js';
import { Container, Graphics, ParticleContainer, Rectangle, Texture } from 'pixi.js';

interface SpriteBounds extends IParticle {
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
      new ParticleContainer({ dynamicProperties: { vertices: true, tint: true }, texture: Texture.WHITE })
    );
    this.alternatingColorsGraphics = this.addChild(new Graphics());

    events.on('sheetFills', this.handleSheetFills);
    events.on('sheetMetaFills', this.handleSheetMetaFills);
    events.on('sheetOffsets', this.drawSheetCells);
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
    events.off('sheetOffsets', this.drawSheetCells);
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
      (sprite) =>
        (sprite.visible = intersects.rectangleRectangle(viewBounds, (sprite as any as SpriteBounds).viewBounds))
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
    this.cellsContainer.removeParticles();
    this.cells.forEach((fill) => {
      const screen = this.sheet.getScreenRectangle(Number(fill.x), Number(fill.y), fill.w, fill.h);
      this.cellsContainer.addParticle({
        x: screen.x,
        y: screen.y,
        texture: Texture.WHITE,

        // todo...
        scaleX: screen.width,
        scaleY: screen.height,

        color: this.getColor(fill.color),

        viewBounds: new Rectangle(screen.x, screen.y, screen.width + 1, screen.height + 1),
      } as SpriteBounds);
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
          const x = Math.max(offset.x, viewport.left);
          const y = Math.max(offset.y, viewport.top);
          this.meta.rect(
            x,
            y,
            viewport.width - (offset.x - viewport.left),
            viewport.height - (offset.y - viewport.top)
          );
          this.meta.fill({ color: this.getColor(fill.color) });
        }

        // infinite column
        else if (fill.h == null && fill.w != null) {
          const startX = Math.max(offset.x, viewport.left);
          const startY = Math.max(offset.y, viewport.top);
          const end = this.sheet.offsets.getColumnPlacement(Number(fill.x) + Number(fill.w));
          let endX = end.position;
          endX = Math.min(endX, viewport.right);
          this.meta.rect(startX, startY, endX - startX, viewport.height - (startY - viewport.top));
          this.meta.fill({ color: this.getColor(fill.color) });
        }

        // infinite row
        else if (fill.w == null && fill.h != null) {
          const startX = Math.max(offset.x, viewport.left);
          const startY = Math.max(offset.y, viewport.top);
          const end = this.sheet.offsets.getRowPlacement(Number(fill.y) + Number(fill.h));
          let endY = end.position;
          endY = Math.min(endY, viewport.bottom);
          this.meta.rect(startX, startY, viewport.width - (startX - viewport.left), endY - startY);
          this.meta.fill({ color: this.getColor(fill.color) });
        }
      });
      pixiApp.setViewportDirty();
    }
  };

  // this is called by Table.ts
  updateAlternatingColors = (x: number, y: number, table?: JsRenderCodeCell) => {
    const key = `${x},${y}`;
    if (table && table.show_ui && table.alternating_colors && !table.is_html_image) {
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
        if (y % 2 !== (table.show_ui && table.show_name !== table.show_columns ? 1 : 0)) {
          this.alternatingColorsGraphics.rect(bounds.x, yOffset, bounds.width, height);
          this.alternatingColorsGraphics.fill({ color: ALTERNATING_BG_COLOR, alpha: ALTERNATING_BG_OPACITY });
        }
        yOffset += height;
      }
    });
    pixiApp.setViewportDirty();
  };
}
