import { ParticleContainer, Sprite, Texture } from 'pixi.js';
import { Bounds } from '../../grid/sheet/Bounds';
import { Sheet } from '../../grid/sheet/Sheet';
import { convertColorStringToTint } from '../../helpers/convertColor';
import { CellsHash } from './CellsHash';
import { CellFill, sheetHashHeight, sheetHashWidth } from './CellsTypes';

export class CellsBackground extends ParticleContainer {
  private cellsHash: CellsHash;
  viewBounds: Bounds;

  constructor(cellsHash: CellsHash) {
    super(sheetHashWidth * sheetHashHeight, { vertices: true, tint: true });
    this.cellsHash = cellsHash;
    this.viewBounds = new Bounds();
  }

  get sheet(): Sheet {
    return this.cellsHash.sheet;
  }

  create(background?: CellFill[]): void {
    this.viewBounds.clear();
    this.removeChildren();
    background = background ?? this.sheet.grid.getCellBackground(this.cellsHash.AABB);
    background.forEach((fill) => {
      const sprite = this.addChild(new Sprite(Texture.WHITE));
      sprite.tint = convertColorStringToTint(fill.color);
      const screen = this.sheet.gridOffsets.getScreenRectangle(fill.x, fill.y, fill.w, fill.h);
      sprite.position.set(screen.x, screen.y);
      sprite.width = screen.width + 1;
      sprite.height = screen.height + 1;
      this.viewBounds.addRectanglePoints(fill.x, fill.y, fill.w, fill.h);
    });
  }
}
