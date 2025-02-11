import { sheets } from '@/app/grid/controller/Sheets';
import type { Sheet } from '@/app/grid/sheet/Sheet';
import type { CellsSheet } from '@/app/gridGL/cells/CellsSheet';
import { intersects } from '@/app/gridGL/helpers/intersects';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { IMAGE_BORDER_OFFSET, IMAGE_BORDER_WIDTH } from '@/app/gridGL/UI/UICellImages';
import type { JsCoordinate } from '@/app/quadratic-core-types';
import type { CoreClientImage } from '@/app/web-workers/quadraticCore/coreClientMessages';
import type { Point } from 'pixi.js';
import { Container, Rectangle, Sprite, Texture } from 'pixi.js';

export class CellsImage extends Container {
  private cellsSheet: CellsSheet;

  private sprite: Sprite;

  pos: { x: number; y: number };

  // size of the image in grid coordinates (excluding the header row)
  gridBounds: Rectangle;

  // original size of the image in pixels
  originalWidth?: number;
  originalHeight?: number;

  // cell size of the image + padding in screen coordinates (excluding the header row)
  viewBounds: Rectangle;

  // corners of the image for pointer interactions
  viewRight: Rectangle;
  viewBottom: Rectangle;

  constructor(cellsSheet: CellsSheet, message: CoreClientImage) {
    super();
    this.cellsSheet = cellsSheet;
    this.pos = { x: message.x, y: message.y };
    this.gridBounds = new Rectangle(message.x, message.y + 1, message.w, message.h - 1);

    this.sprite = this.addChild(new Sprite(Texture.EMPTY));

    this.viewBounds = this.sheet.getScreenRectangle(
      this.gridBounds.x,
      this.gridBounds.y,
      this.gridBounds.width,
      this.gridBounds.height
    );

    this.viewRight = new Rectangle();
    this.viewBottom = new Rectangle();

    this.reposition();
    this.updateMessage(message);

    console.log(message);
  }

  get sheetId(): string {
    return this.cellsSheet.sheetId;
  }

  get column(): number {
    return this.gridBounds.x;
  }
  get row(): number {
    return this.pos.y;
  }

  updateMessage(message: CoreClientImage) {
    if (!message.image) {
      throw new Error('Expected message.image to be defined in SpriteImage.updateMessage');
    }
    this.sprite.texture = Texture.from(message.image);
    // this.imageWidth = message.pixel_width;
    // this.imageHeight = message.pixel_height;
    this.resizeImage();
  }

  get sheet(): Sheet {
    const sheet = sheets.getById(this.sheetId);
    if (!sheet) throw new Error(`Expected sheet to be defined in CellsFills.sheet`);
    return sheet;
  }

  fitImage(width = this.viewBounds.width, height = this.viewBounds.height) {
    if (this.originalWidth === undefined || this.originalHeight === undefined) {
      return;
    }
    const aspectRatio = this.originalWidth / this.originalHeight;
    const headerHeight = this.sheet.offsets.getRowHeight(this.pos.y);

    // Calculate maximum dimensions
    const maxWidth = Math.min(width, this.originalWidth);
    const maxHeight = Math.min(height - headerHeight, this.originalHeight);

    if (maxWidth / maxHeight > aspectRatio) {
      this.sprite.width = maxHeight * aspectRatio;
      this.sprite.height = maxHeight;
    } else {
      this.sprite.width = maxWidth;
      this.sprite.height = maxWidth / aspectRatio;
    }

    // center the image
    this.sprite.position.set(width / 2 - this.sprite.width / 2, (height - headerHeight) / 2 - this.sprite.height / 2);
  }

  temporaryResize(width: number, height: number) {
    this.fitImage(width, height);
  }

  resizeImage = (width?: number, height?: number) => {
    // if (width !== undefined && height !== undefined) {
    // this.imageWidth = width;
    // this.imageHeight = height;
    // }

    // We need to wait until the baseTexture loads from the string before we can
    // calculate bounds. We do not have to wait if we have a user-set size.
    if (!this.sprite.texture.baseTexture.valid) {
      this.sprite.texture.once('update', this.resizeImage);
      return;
    }

    this.originalWidth = this.sprite.width;
    this.originalHeight = this.sprite.height;

    // if (this.imageWidth && this.imageHeight) {
    //   this.sprite.width = this.imageWidth;
    //   this.sprite.height = this.imageHeight;
    // } else {
    //   this.sprite.width = this.sprite.texture.width;
    //   this.sprite.height = this.sprite.texture.height;
    // }

    this.viewRight = new Rectangle(
      this.viewBounds.right - IMAGE_BORDER_OFFSET,
      this.viewBounds.y,
      IMAGE_BORDER_WIDTH,
      this.viewBounds.height
    );
    this.viewBottom = new Rectangle(
      this.viewBounds.x,
      this.viewBounds.bottom - IMAGE_BORDER_OFFSET,
      this.viewBounds.width,
      IMAGE_BORDER_WIDTH
    );

    if (this.cellsSheet.sheetId === sheets.current) {
      pixiApp.setViewportDirty();
    }
    this.sheet.gridOverflowLines.updateImageHtml(this.pos.x, this.pos.y, this.gridBounds.width, this.gridBounds.height);

    this.fitImage();
  };

  reposition() {
    const screen = this.sheet.getCellOffsets(this.gridBounds.x, this.gridBounds.y);
    this.position.set(screen.x, screen.y);
    this.resizeImage();
  }

  contains(world: Point): JsCoordinate | undefined {
    if (intersects.rectanglePoint(this.viewBounds, world)) {
      return { x: this.pos.x, y: this.pos.y };
    }
    return undefined;
  }

  isImageCell(x: number, y: number): boolean {
    return x >= this.gridBounds.x && x < this.gridBounds.right && y >= this.pos.y && y < this.gridBounds.bottom - 1;
  }
}
