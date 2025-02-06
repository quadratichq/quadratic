import { sheets } from '@/app/grid/controller/Sheets';
import type { Sheet } from '@/app/grid/sheet/Sheet';
import type { CellsSheet } from '@/app/gridGL/cells/CellsSheet';
import { intersects } from '@/app/gridGL/helpers/intersects';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { IMAGE_BORDER_OFFSET, IMAGE_BORDER_WIDTH } from '@/app/gridGL/UI/UICellImages';
import type { JsCoordinate } from '@/app/quadratic-core-types';
import type { CoreClientImage } from '@/app/web-workers/quadraticCore/coreClientMessages';
import type { Point } from 'pixi.js';
import { Container, Graphics, Rectangle, Sprite, Texture } from 'pixi.js';

export class CellsImage extends Container {
  private cellsSheet: CellsSheet;

  private background: Graphics;
  private sprite: Sprite;

  pos: { x: number; y: number };

  gridBounds: Rectangle;

  // these are user set values for the image size
  imageWidth?: number;
  imageHeight?: number;

  viewBounds: Rectangle;
  viewRight: Rectangle;
  viewBottom: Rectangle;

  constructor(cellsSheet: CellsSheet, message: CoreClientImage) {
    super();
    this.cellsSheet = cellsSheet;
    this.pos = { x: message.x, y: message.y };
    this.gridBounds = new Rectangle(message.x, message.y + 1, 0, 0);
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
    const sheet = sheets.getById(this.sheetId);
    if (!sheet) {
      throw new Error(`Expected sheet to be defined in CellsImage.resizeImage`);
    }
    sheet.gridOverflowLines.updateImageHtml(this.pos.x, this.pos.y, this.sprite.width, this.sprite.height);
    this.cellsSheet.tables.resizeTable(this.pos.x, this.pos.y, this.sprite.width, this.sprite.height);
    if (this.cellsSheet.sheetId === sheets.current) {
      pixiApp.setViewportDirty();
    }
    const right = this.sheet.offsets.getXPlacement(this.viewRight.x + IMAGE_BORDER_WIDTH).index;
    const bottom = this.sheet.offsets.getYPlacement(this.viewBottom.y + IMAGE_BORDER_WIDTH).index;
    this.gridBounds.width = right - this.gridBounds.x + 1;
    this.gridBounds.height = bottom - this.gridBounds.y + 1;
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
    return x >= this.gridBounds.x && x < this.gridBounds.right && y >= this.pos.y && y < this.gridBounds.bottom;
  }
}
