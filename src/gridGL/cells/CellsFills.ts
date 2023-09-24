import { ParticleContainer, Rectangle, Sprite, Texture } from 'pixi.js';
import { grid } from '../../grid/controller/Grid';
import { Sheet } from '../../grid/sheet/Sheet';
import { convertColorStringToTint } from '../../helpers/convertColor';
import { intersects } from '../helpers/intersects';
import { CellsSheet } from './CellsSheet';

interface SpriteBounds extends Sprite {
  viewBounds: Rectangle;
}

export class CellsFills extends ParticleContainer {
  private cellsSheet: CellsSheet;

  constructor(cellsSheet: CellsSheet) {
    super(undefined, { vertices: true, tint: true });
    this.cellsSheet = cellsSheet;
  }

  get sheet(): Sheet {
    return this.cellsSheet.sheet;
  }

  create(): void {
    this.removeChildren();
    const fills = this.sheet.getAllRenderFills();
    fills.forEach((fill) => {
      const sprite = this.addChild(new Sprite(Texture.WHITE)) as SpriteBounds;
      sprite.tint = convertColorStringToTint(fill.color);
      const screen = grid.getScreenRectangle(this.sheet.id, Number(fill.x), Number(fill.y), fill.w - 1, fill.h - 1);
      sprite.position.set(screen.x, screen.y);
      sprite.width = screen.width + 1;
      sprite.height = screen.height + 1;
      sprite.viewBounds = new Rectangle(screen.x, screen.y, screen.width + 1, screen.height + 1);
    });
  }

  cheapCull(viewBounds: Rectangle) {
    this.children.forEach(
      (sprite) => (sprite.visible = intersects.rectangleRectangle(viewBounds, (sprite as SpriteBounds).viewBounds))
    );
  }
}
