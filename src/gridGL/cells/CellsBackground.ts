import { ParticleContainer, Sprite, Texture } from 'pixi.js';
import { SheetRust } from '../../grid/sheet/SheetRust';
import { convertColorStringToTint } from '../../helpers/convertColor';
import { CellFill, sheetHashHeight, sheetHashWidth } from './CellsTypes';

export class CellsBackground extends ParticleContainer {
  private sheet: SheetRust;

  constructor(sheet: SheetRust) {
    super(sheetHashWidth * sheetHashHeight, { vertices: true, tint: true });
    this.sheet = sheet;
  }

  create(background: CellFill[]): void {
    this.removeChildren();
    background.forEach((fill) => {
      const sprite = this.addChild(new Sprite(Texture.WHITE));
      sprite.tint = convertColorStringToTint(fill.color);
      const screen = this.sheet.gridOffsets.getScreenRectangle(fill.x, fill.y, fill.w, fill.h);
      sprite.position.set(screen.x, screen.y);
      sprite.width = screen.width + 1;
      sprite.height = screen.height + 1;
    });
  }
}
