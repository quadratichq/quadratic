import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { JsRenderFill, JsSheetFill } from '@/app/quadratic-core-types';
import { Container, Graphics, ParticleContainer, Rectangle, Sprite, Texture } from 'pixi.js';
import { Sheet } from '../../grid/sheet/Sheet';
import { convertColorStringToTint } from '../../helpers/convertColor';
import { intersects } from '../helpers/intersects';
import { pixiApp } from '../pixiApp/PixiApp';
import { CellsSheet } from './CellsSheet';

// todo: might want to add this to the update loop instead of listening for
// viewport changes to avoid multiple calls to drawMeta

interface SpriteBounds extends Sprite {
  viewBounds: Rectangle;
}

interface ColumnRow {
  row?: number;
  column?: number
  color: string;
  timestamp: number;
}

export class CellsFills extends Container {
  private cellsSheet: CellsSheet;
  private fills: JsRenderFill[] = [];
  private metaFill?: JsSheetFill;

  private cells: ParticleContainer;
  private meta: Graphics;
  private metaHasContent = false;

  constructor(cellsSheet: CellsSheet) {
    super();
    this.cellsSheet = cellsSheet;
    this.cells = this.addChild(new ParticleContainer(undefined, { vertices: true, tint: true }, undefined, true));
    this.meta = this.addChild(new Graphics());

    events.on('sheetFills', (sheetId, fills) => {
      if (sheetId === this.cellsSheet.sheetId) {
        this.fills = fills;
        this.drawCells();
      }
    });
    events.on('sheetMetaFills', (sheetId, fills) => {
      if (sheetId === this.cellsSheet.sheetId) {
        console.log(fills)
        if (this.isMetaEmpty(fills)) {
          this.metaFill = undefined;
          this.meta.clear();
          pixiApp.setViewportDirty();
        } else {
          this.metaFill = fills;
          this.drawMeta();
        }
      }
    });
    events.on('sheetOffsets', (sheetId) => {
      if (sheetId === this.cellsSheet.sheetId) {
        this.drawCells();
      }
    });

    pixiApp.viewport.on('zoomed', this.drawMeta);
    pixiApp.viewport.on('moved', this.drawMeta);
  }

  cheapCull(viewBounds: Rectangle) {
    this.cells.children.forEach(
      (sprite) => (sprite.visible = intersects.rectangleRectangle(viewBounds, (sprite as SpriteBounds).viewBounds))
    );
  }

  private isMetaEmpty(fill: JsSheetFill): boolean {
    return !(fill.all || fill.columns.length || fill.rows.length);
  }

  private get sheet(): Sheet {
    const sheet = sheets.getById(this.cellsSheet.sheetId);
    if (!sheet) throw new Error(`Expected sheet to be defined in CellsFills.sheet`);
    return sheet;
  }

  private drawCells() {
    this.cells.removeChildren();
    this.fills.forEach((fill) => {
      const sprite = this.addChild(new Sprite(Texture.WHITE)) as SpriteBounds;
      sprite.tint = convertColorStringToTint(fill.color);
      const screen = this.sheet.getScreenRectangle(Number(fill.x), Number(fill.y), fill.w - 1, fill.h - 1);
      sprite.position.set(screen.x, screen.y);
      sprite.width = screen.width;
      sprite.height = screen.height;
      sprite.viewBounds = new Rectangle(screen.x, screen.y, screen.width + 1, screen.height + 1);
    });
    pixiApp.setViewportDirty();
  }

  private drawMeta = () => {
    if (this.metaFill) {
      this.meta.clear();
      const viewport = pixiApp.viewport.getVisibleBounds();
      if (this.metaFill.all) {
        this.meta.beginFill(convertColorStringToTint(this.metaFill.all));
        this.meta.drawRect(viewport.left, viewport.top, viewport.width, viewport.height);
        this.meta.endFill();
      }

      // combine the column and row fills and sort them by their timestamp so
      // they are drawn in the correct order
      const columns: ColumnRow[] = this.metaFill.columns.map(entry => ({ column: Number(entry[0]), row: undefined, color: entry[1][0], timestamp: Number(entry[1][1]) }));
      const rows: ColumnRow[] = this.metaFill.rows.map(entry => ({ column: undefined, row: Number(entry[0]), color: entry[1][0], timestamp: Number(entry[1][1]) }));
      const fills = [...columns, ...rows].sort((a, b) => (a.timestamp - b.timestamp));

      fills.forEach(fill => {
        if (fill.column !== undefined) {
          const screen = this.sheet.offsets.getColumnPlacement(Number(fill.column));
          const left = screen.position;
          const width = screen.size;

          // only draw if the column is visible on the screen
          if (left >= viewport.right || left + width <= viewport.left) return;

          this.meta.beginFill(convertColorStringToTint(fill.color));
          this.meta.drawRect(left, viewport.top, width, viewport.height);
          this.meta.endFill();
        } else if (fill.row !== undefined) {
          const screen = this.sheet.offsets.getRowPlacement(fill.row);
          const top = screen.position;
          const height = screen.size;

          // only draw if the row is visible on the screen
          if (top >= viewport.bottom || top + height <= viewport.top) return;

          this.meta.beginFill(convertColorStringToTint(fill.color));
          this.meta.drawRect(viewport.left, top, viewport.width, height);
          this.meta.endFill();
        }
      });
      pixiApp.setViewportDirty();
    }
  };
}
