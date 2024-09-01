import { Container, Sprite, Texture, TilingSprite } from 'pixi.js';
import { CellsTextHash } from './CellsTextHash';
import { JsBorderHorizontal, JsBorders, JsBorderVertical } from '@/app/quadratic-core-types';
import { BorderCull, drawHorizontalBorder } from '../drawBorders';
import { sheets } from '@/app/grid/controller/Sheets';

export class CellsHashBorders extends Container {
  private cellsTextHash: CellsTextHash;
  private sprites: BorderCull[] = [];

  private horizontal?: JsBorderHorizontal[];
  private vertical?: JsBorderVertical[];

  // This may be constructed after a bordersHash event has been received
  constructor(cellsTextHash: CellsTextHash) {
    super();
    this.cellsTextHash = cellsTextHash;
  }

  update(borders: JsBorders) {
    this.horizontal = borders.horizontal;
    this.vertical = borders.vertical;
    this.draw();
  }

  private draw() {
    this.removeChildren();
    const sheet = sheets.getById(this.cellsTextHash.sheetId);
    if (!sheet) return;

    this.horizontal?.forEach((border) => {
      drawHorizontalBorder(border, this.getSprite, this.sprites, sheet);
    });

    this.vertical?.forEach((border) => {
      // drawVerticalBorder(border, this.getSprite, this.sprites, sheet);
    });

    this.sprites.forEach((sprite) => this.addChild(sprite.sprite));
  }

  // get sprites
  private getSprite = (tiling?: boolean): Sprite | TilingSprite => {
    if (tiling) {
      return this.addChild(new TilingSprite(Texture.WHITE));
    } else {
      return this.addChild(new Sprite(Texture.WHITE));
    }
  };
}
