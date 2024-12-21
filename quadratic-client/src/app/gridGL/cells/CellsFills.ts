import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { JsRenderCodeCell, JsRenderFill, JsSheetFill } from '@/app/quadratic-core-types';
import { Sheet } from '@/app/grid/sheet/Sheet';
import { CellsSheet } from '@/app/gridGL/cells/CellsSheet';
import { intersects } from '@/app/gridGL/helpers/intersects';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { convertColorStringToTint } from '@/app/helpers/convertColor';
import { colors } from '@/app/theme/colors';
import { sharedEvents } from '@/shared/sharedEvents';
import { Container, Graphics, ParticleContainer, Rectangle, Sprite, Texture } from 'pixi.js';

interface SpriteBounds extends Sprite {
  viewBounds: Rectangle;
}

<<<<<<< HEAD
interface ColumnRow {
  row: number | null;
  column: number | null;
  color: string;
  timestamp: number;
}

const ALTERNATING_COLOR_LUMINOSITY = 1.85;

export class CellsFills extends Container {
  private cellsSheet: CellsSheet;
  private cells: JsRenderFill[] = [];
  private metaFill?: JsSheetFill;
  private alternatingColors: Map<string, JsRenderCodeCell> = new Map();
=======
export class CellsFills extends Container {
  private cellsSheet: CellsSheet;
  private cells: JsRenderFill[] = [];
  private sheetFills?: JsSheetFill[];
>>>>>>> origin/qa

  private cellsContainer: ParticleContainer;
  private alternatingColorsGraphics: Graphics;
  private meta: Graphics;

  private dirty = false;

  constructor(cellsSheet: CellsSheet) {
    super();
    this.cellsSheet = cellsSheet;
    this.meta = this.addChild(new Graphics());
    this.alternatingColorsGraphics = this.addChild(new Graphics());
    this.cellsContainer = this.addChild(
      new ParticleContainer(undefined, { vertices: true, tint: true }, undefined, true)
    );

<<<<<<< HEAD
    events.on('sheetFills', (sheetId, fills) => {
      if (sheetId === this.cellsSheet.sheetId) {
        this.cells = fills;
        this.drawCells();
      }
    });
    events.on('sheetMetaFills', (sheetId, fills) => {
      if (sheetId === this.cellsSheet.sheetId) {
        if (this.isMetaEmpty(fills)) {
          this.metaFill = undefined;
          this.meta.clear();
          pixiApp.setViewportDirty();
        } else {
          this.metaFill = fills;
          this.setDirty();
        }
      }
    });

=======
    events.on('sheetFills', this.handleSheetFills);
    events.on('sheetMetaFills', this.handleSheetMetaFills);
>>>>>>> origin/qa
    events.on('sheetOffsets', this.drawSheetCells);
    events.on('cursorPosition', this.setDirty);
    events.on('resizeHeadingColumn', this.drawCells);
    events.on('resizeHeadingRow', this.drawCells);
<<<<<<< HEAD
    sharedEvents.on('changeThemeAccentColor', this.drawAlternatingColors);
    pixiApp.viewport.on('zoomed', this.setDirty);
    pixiApp.viewport.on('moved', this.setDirty);
=======
    events.on('resizeHeadingRow', this.drawSheetCells);
    events.on('resizeHeadingColumn', this.drawSheetCells);
    events.on('viewportChanged', this.setDirty);
>>>>>>> origin/qa
  }

  destroy() {
    events.off('sheetFills', this.handleSheetFills);
    events.off('sheetMetaFills', this.handleSheetMetaFills);
    events.off('sheetOffsets', this.drawSheetCells);
    events.off('cursorPosition', this.setDirty);
    events.off('resizeHeadingColumn', this.drawCells);
    events.off('resizeHeadingRow', this.drawCells);
    events.off('resizeHeadingRow', this.drawSheetCells);
    events.off('resizeHeadingColumn', this.drawSheetCells);
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
    this.cells.forEach((fill) => {
      const sprite = this.cellsContainer.addChild(new Sprite(Texture.WHITE)) as SpriteBounds;
      sprite.tint = this.getColor(fill.color);
      const screen = this.sheet.getScreenRectangle(Number(fill.x), Number(fill.y), fill.w, fill.h);
      sprite.position.set(screen.x, screen.y);
      sprite.width = screen.width;
      sprite.height = screen.height;
      sprite.viewBounds = new Rectangle(screen.x, screen.y, screen.width + 1, screen.height + 1);
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
    if (table) {
      this.alternatingColors.set(key, table);
      this.setDirty();
    } else {
      if (this.alternatingColors.has(key)) {
        this.alternatingColors.delete(key);
        this.setDirty();
      }
    }
  };

  private drawAlternatingColors = () => {
    this.alternatingColorsGraphics.clear();
    const color = getCSSVariableTint('primary', { luminosity: ALTERNATING_COLOR_LUMINOSITY });
    this.alternatingColors.forEach((table) => {
      const bounds = this.sheet.getScreenRectangle(table.x, table.y + 1, table.w - 1, table.y);
      let yOffset = bounds.y;
      for (let y = table.show_header ? 1 : 0; y < table.h - 1; y++) {
        let height = this.sheet.offsets.getRowHeight(y + table.y);
        if (y % 2 === 0) {
          this.alternatingColorsGraphics.beginFill(color);
          this.alternatingColorsGraphics.drawRect(bounds.x, yOffset, bounds.width, height);
          this.alternatingColorsGraphics.endFill();
        }
        yOffset += height;
      }
    });
  };
}
