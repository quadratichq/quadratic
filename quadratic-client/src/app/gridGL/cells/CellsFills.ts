import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { JsRenderFill } from '@/app/quadratic-core-types';
import { ParticleContainer, Rectangle, Sprite, Texture } from 'pixi.js';
import { Sheet } from '../../grid/sheet/Sheet';
import { convertColorStringToTint } from '../../helpers/convertColor';
import { intersects } from '../helpers/intersects';
import { pixiApp } from '../pixiApp/PixiApp';
import { CellsSheet } from './CellsSheet';

export interface SpriteBounds extends Sprite {
  viewBounds: Rectangle;
}

export class CellsFills extends ParticleContainer {
  private cellsSheet: CellsSheet;
  private fills: JsRenderFill[] = [];

  constructor(cellsSheet: CellsSheet) {
    super(undefined, { vertices: true, tint: true }, undefined, true);
    this.cellsSheet = cellsSheet;
    events.on('sheetFills', (sheetId, fills) => {
      if (sheetId === this.cellsSheet.sheetId) {
        this.fills = fills;
        this.draw();
        pixiApp.setViewportDirty();
      }
    });
    events.on('sheetOffsets', (sheetId) => {
      if (sheetId === this.cellsSheet.sheetId) {
        this.draw();
      }
    });
  }

  get sheet(): Sheet {
    const sheet = sheets.getById(this.cellsSheet.sheetId);
    if (!sheet) throw new Error(`Expected sheet to be defined in CellsFills.sheet`);
    return sheet;
  }

  draw() {
    this.removeChildren();
    this.fills.forEach((fill) => {
      const sprite = this.addChild(new Sprite(Texture.WHITE)) as SpriteBounds;
      sprite.tint = convertColorStringToTint(fill.color);
      const screen = this.sheet.getScreenRectangle(Number(fill.x), Number(fill.y), fill.w - 1, fill.h - 1);
      sprite.position.set(screen.x, screen.y);
      sprite.width = screen.width;
      sprite.height = screen.height;
      sprite.viewBounds = new Rectangle(screen.x, screen.y, screen.width + 1, screen.height + 1);
    });
  }

  cheapCull(viewBounds: Rectangle) {
    this.children.forEach(
      (sprite) => (sprite.visible = intersects.rectangleRectangle(viewBounds, (sprite as SpriteBounds).viewBounds))
    );
  }
}
