import { Container, Graphics, Rectangle, Sprite, Texture } from 'pixi.js';

import { sheets } from '@/app/grid/controller/Sheets';
import type { Sheet } from '@/app/grid/sheet/Sheet';
import type { CellsSheet } from '@/app/gridGL/cells/CellsSheet';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { IMAGE_BORDER_OFFSET, IMAGE_BORDER_WIDTH } from '@/app/gridGL/UI/UICellImages';
import type { CoreClientImage } from '@/app/web-workers/quadraticCore/coreClientMessages';

export class CellsImage extends Container {
  private cellsSheet: CellsSheet;

  private background: Graphics;
  private sprite: Sprite;

  column: number;
  row: number;

  // these are user set values for the image size
  imageWidth?: number;
  imageHeight?: number;

  viewBounds: Rectangle;
  viewRight: Rectangle;
  viewBottom: Rectangle;

  constructor(cellsSheet: CellsSheet, message: CoreClientImage) {
    super();
    this.cellsSheet = cellsSheet;
    this.column = message.x;
    this.row = message.y;
    this.background = this.addChild(new Graphics());
    this.sprite = this.addChild(new Sprite(Texture.EMPTY));

    // placeholders until we can properly resize the image (we need to wait
    // until the baseTexture loads from the string before we can calculate
    // bounds)
    this.viewBounds = new Rectangle();
    this.viewRight = new Rectangle();
    this.viewBottom = new Rectangle();

    this.reposition();
    this.updateMessage(message);
  }

  get sheetId(): string {
    return this.cellsSheet.sheetId;
  }

  updateMessage(message: CoreClientImage) {
    if (!message.image) {
      throw new Error('Expected message.image to be defined in SpriteImage.updateMessage');
    }
    this.sprite.texture = Texture.from(message.image);
    this.imageWidth = message.w ? parseFloat(message.w) : undefined;
    this.imageHeight = message.h ? parseFloat(message.h) : undefined;
    this.resizeImage();
  }

  private get sheet(): Sheet {
    const sheet = sheets.getById(this.sheetId);
    if (!sheet) throw new Error(`Expected sheet to be defined in CellsFills.sheet`);
    return sheet;
  }

  temporaryResize(width: number, height: number) {
    this.sprite.width = width;
    this.sprite.height = height;
    this.redrawBackground();
  }

  private redrawBackground() {
    this.background.clear();
    this.background.beginFill(0xffffff);
    this.background.drawRect(0, 0, this.sprite.width, this.sprite.height);
  }

  resizeImage = (width?: number, height?: number) => {
    if (width !== undefined && height !== undefined) {
      this.imageWidth = width;
      this.imageHeight = height;
    }

    // We need to wait until the baseTexture loads from the string before we can
    // calculate bounds. We do not have to wait if we have a user-set size.
    else if (!this.sprite.texture.baseTexture.valid) {
      this.sprite.texture.once('update', this.resizeImage);
      return;
    }

    if (this.imageWidth && this.imageHeight) {
      this.sprite.width = this.imageWidth;
      this.sprite.height = this.imageHeight;
    } else {
      this.sprite.width = this.sprite.texture.width;
      this.sprite.height = this.sprite.texture.height;
    }

    this.redrawBackground();

    this.viewBounds = new Rectangle(this.x, this.y, this.sprite.width, this.sprite.height);
    this.viewRight = new Rectangle(
      this.x + this.sprite.width - IMAGE_BORDER_OFFSET,
      this.y,
      IMAGE_BORDER_WIDTH,
      this.sprite.height
    );
    this.viewBottom = new Rectangle(
      this.x,
      this.y + this.sprite.height - IMAGE_BORDER_OFFSET,
      this.sprite.width,
      IMAGE_BORDER_WIDTH
    );
    if (this.cellsSheet.sheetId === sheets.current) {
      pixiApp.setViewportDirty();
    }
  };

  reposition() {
    const screen = this.sheet.getCellOffsets(this.column, this.row + 1);
    this.position.set(screen.x, screen.y);
    this.resizeImage();
  }
}
