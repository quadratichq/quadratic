import { events } from '@/events/events';
import { sheets } from '@/grid/controller/Sheets';
import { Sheet } from '@/grid/sheet/Sheet';
import { CoreClientImage } from '@/web-workers/quadraticCore/coreClientMessages';
import { Container, Rectangle, Sprite, Texture } from 'pixi.js';
import { intersects } from '../helpers/intersects';
import { CellsSheet } from './CellsSheet';

interface SpriteImage extends Sprite {
  viewBounds: Rectangle;
  column: number;
  row: number;
}

export class CellsImages extends Container<SpriteImage> {
  private cellsSheet: CellsSheet;

  constructor(cellsSheet: CellsSheet) {
    super();
    this.cellsSheet = cellsSheet;
    events.on('updateImage', this.updateImage);
    events.on('sheetOffsets', this.reposition);
  }

  destroy() {
    super.destroy();
    events.off('updateImage', this.updateImage);
    events.off('sheetOffsets', this.reposition);
  }

  cheapCull(bounds: Rectangle) {
    this.children.forEach((sprite) => {
      sprite.visible = intersects.rectangleRectangle(bounds, sprite.viewBounds);
    });
  }

  private get sheet(): Sheet {
    const sheet = sheets.getById(this.cellsSheet.sheetId);
    if (!sheet) throw new Error(`Expected sheet to be defined in CellsFills.sheet`);
    return sheet;
  }

  private updateImage = (message: CoreClientImage) => {
    if (message.sheetId === this.cellsSheet.sheetId) {
      let sprite = this.children.find(
        (sprite) => (sprite as SpriteImage).column === message.x && (sprite as SpriteImage).row === message.y
      );
      if (sprite) {
        if (message.image) {
          sprite.texture = Texture.from(message.image);
        } else {
          this.removeChild(sprite);
        }
      } else {
        if (message.image) {
          const justSprite = new Sprite(Texture.from(message.image));
          sprite = justSprite as SpriteImage;
          sprite.column = message.x;
          sprite.row = message.y;
          this.addChild(sprite);
          const screen = this.sheet.offsets.getCellOffsets(message.x, message.y + 1);
          sprite.position.set(screen.x, screen.y);
        }
      }
      if (sprite) {
        if (message.w && message.h) {
          const width = parseFloat(message.w);
          const height = parseFloat(message.h);
          sprite.width = width;
          sprite.height = height;
        }
        sprite.viewBounds = new Rectangle(sprite.x, sprite.y, sprite.width, sprite.height);
      }
    }
  };

  private reposition = (sheetId: string) => {
    if (sheetId === this.cellsSheet.sheetId) {
      this.children.forEach((sprite) => {
        const screen = this.sheet.offsets.getCellOffsets(sprite.column, sprite.row);
        sprite.position.set(screen.x, screen.y);
        sprite.viewBounds = new Rectangle(screen.x, screen.y, sprite.width, sprite.height);
      });
    }
  };
}
