import { ParticleContainer, Sprite, Texture } from 'pixi.js';
import { GridSparseRust } from '../../grid/sheet/GridSparseRust';
import { SheetRust } from '../../grid/sheet/SheetRust';
import { convertColorStringToTint } from '../../helpers/convertColor';
import { CellsHash } from './CellsHash';
import { CellFill, sheetHashHeight, sheetHashWidth } from './CellsTypes';

export class CellsBackground extends ParticleContainer {
  private cellsHash: CellsHash;

  constructor(cellsHash: CellsHash) {
    super(sheetHashWidth * sheetHashHeight, { vertices: true, tint: true });
    this.cellsHash = cellsHash;
  }

  get sheet(): SheetRust {
    return this.cellsHash.sheet;
  }

  create(background?: CellFill[]): void {
    this.removeChildren();
    background = background ?? (this.sheet.grid as GridSparseRust).getCellBackground(this.cellsHash.AABB);
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
