import { events } from '@/events/events';
import { sheets } from '@/grid/controller/Sheets';
import { Sheet } from '@/grid/sheet/Sheet';
import { CoreClientImage } from '@/web-workers/quadraticCore/coreClientMessages';
import { Container, Rectangle, Sprite, Texture } from 'pixi.js';
import { intersects } from '../helpers/intersects';
import { pixiApp } from '../pixiApp/PixiApp';
import { IMAGE_BORDER_OFFSET, IMAGE_BORDER_WIDTH } from '../UI/UIImageResize';
import { CellsSheet } from './CellsSheet';

export interface SpriteImage extends Sprite {
  sheetId: string;
  column: number;
  row: number;
  viewBounds: Rectangle;
  viewRight: Rectangle;
  viewBottom: Rectangle;
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

  resizeImage = (sprite: SpriteImage) => {
    sprite.viewBounds = new Rectangle(sprite.x, sprite.y, sprite.width, sprite.height);
    sprite.viewRight = new Rectangle(
      sprite.x + sprite.width - IMAGE_BORDER_OFFSET,
      sprite.y,
      IMAGE_BORDER_WIDTH,
      sprite.height
    );
    sprite.viewBottom = new Rectangle(
      sprite.x,
      sprite.y + sprite.height - IMAGE_BORDER_OFFSET,
      sprite.width,
      IMAGE_BORDER_WIDTH
    );
    if (sprite.sheetId === sheets.current) {
      pixiApp.setViewportDirty();
    }
  };

  private repositionImage(sprite: SpriteImage) {
    const screen = this.sheet.offsets.getCellOffsets(sprite.column, sprite.row + 1);
    sprite.position.set(screen.x, screen.y);

    // We need to wait until the baseTexture loads from the string before we can calculate bounds.
    if (!sprite.texture.baseTexture.valid) {
      sprite.texture.once('update', () => this.resizeImage(sprite));
    } else {
      this.resizeImage(sprite);
    }
  }

  private reposition = (sheetId: string) => {
    if (sheetId === this.cellsSheet.sheetId) {
      this.children.forEach((sprite) => this.repositionImage(sprite));
    }
  };

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
          sprite = undefined;
        }
      } else {
        if (message.image) {
          const justSprite = new Sprite(Texture.from(message.image));
          sprite = justSprite as SpriteImage;
          sprite.sheetId = message.sheetId;
          sprite.column = message.x;
          sprite.row = message.y;
          this.addChild(sprite);
        }
      }
      if (sprite) {
        if (message.w && message.h) {
          const width = parseFloat(message.w);
          const height = parseFloat(message.h);
          sprite.width = width;
          sprite.height = height;
        }
        this.repositionImage(sprite);
      }
      pixiApp.setViewportDirty();
    }
  };
}
