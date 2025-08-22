import { sheets } from '@/app/grid/controller/Sheets';
import type { Sheet } from '@/app/grid/sheet/Sheet';
import type { CellsSheet } from '@/app/gridGL/cells/CellsSheet';
import type { Table } from '@/app/gridGL/cells/tables/Table';
import { intersects } from '@/app/gridGL/helpers/intersects';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { IMAGE_BORDER_OFFSET, IMAGE_BORDER_WIDTH } from '@/app/gridGL/UI/UICellImages';
import type { JsCoordinate } from '@/app/quadratic-core-types';
import type { CoreClientImage } from '@/app/web-workers/quadraticCore/coreClientMessages';
import type { Point } from 'pixi.js';
import { Container, Rectangle, Sprite, Texture } from 'pixi.js';

// todo: rename to resize; separate bottom and right bars so they can animate separately

export class CellsImage extends Container {
  private cellsSheet: CellsSheet;

  private sprite: Sprite;

  pos: { x: number; y: number };

  private aspectRatio?: number;

  // corners of the image for pointer interactions
  viewRight: Rectangle;
  viewBottom: Rectangle;

  imageBounds: Rectangle;

  dataUrl: string | undefined;

  constructor(cellsSheet: CellsSheet, message: CoreClientImage) {
    super();
    this.cellsSheet = cellsSheet;
    this.pos = { x: message.x, y: message.y };

    this.sprite = this.addChild(new Sprite(Texture.EMPTY));

    this.imageBounds = this.sheet.getScreenRectangle(this.pos.x, this.pos.y + 1, message.w, message.h - 1);

    this.viewRight = new Rectangle();
    this.viewBottom = new Rectangle();

    this.dataUrl = message.image;

    this.reposition();
    this.updateMessage(message);
  }

  destroy() {
    this.sheet.gridOverflowLines.updateImageHtml(this.pos.x, this.pos.y);
    super.destroy();
  }

  get table(): Table {
    const table = this.cellsSheet.tables.getTable(this.pos.x, this.pos.y);
    if (!table) throw new Error('Expected table to be defined in CellsImage.table');
    return table;
  }

  get sheetId(): string {
    return this.cellsSheet.sheetId;
  }

  get column(): number {
    return this.pos.x;
  }
  get row(): number {
    return this.pos.y;
  }

  updateMessage(message: CoreClientImage) {
    if (!message.image) {
      throw new Error('Expected message.image to be defined in SpriteImage.updateMessage');
    }
    this.sprite.texture = Texture.from(message.image);
    this.resizeImage();
  }

  get sheet(): Sheet {
    const sheet = sheets.getById(this.sheetId);
    if (!sheet) throw new Error(`Expected sheet to be defined in CellsFills.sheet`);
    return sheet;
  }

  fitImage(width = this.table.tableBounds.width, height = this.table.tableBounds.height) {
    if (this.aspectRatio === undefined) {
      return;
    }
    const headerHeight = this.sheet.offsets.getRowHeight(this.pos.y);

    // Calculate maximum dimensions
    const maxWidth = width;
    const maxHeight = height - headerHeight;
    if (maxWidth / maxHeight > this.aspectRatio) {
      this.sprite.width = maxHeight * this.aspectRatio;
      this.sprite.height = maxHeight;
    } else {
      this.sprite.width = maxWidth;
      this.sprite.height = maxWidth / this.aspectRatio;
    }

    // center the image
    this.sprite.position.set(width / 2 - this.sprite.width / 2, (height - headerHeight) / 2 - this.sprite.height / 2);
  }

  temporaryResize(width: number, height: number) {
    this.fitImage(width, height);
    const tableBounds = this.table.tableBounds;
    const end = sheets.sheet.getColumnRowFromScreen(tableBounds.right, tableBounds.bottom);
    this.sheet.gridOverflowLines.updateImageHtml(this.pos.x, this.pos.y, end.column - this.pos.x, end.row - this.pos.y);
  }

  resizeImage = () => {
    // We need to wait until the baseTexture loads from the string before we can
    // calculate bounds. We do not have to wait if we have a user-set size.
    if (!this.sprite.texture.baseTexture.valid) {
      this.sprite.texture.once('update', this.resizeImage);
      return;
    }

    // store original size once it's loaded
    if (!this.aspectRatio) {
      this.aspectRatio = this.sprite.width / this.sprite.height;
    }

    const table = this.table;
    this.imageBounds = this.sheet.getScreenRectangle(
      this.pos.x,
      this.pos.y + 1,
      table.tableBounds.width,
      table.tableBounds.height - 1
    );

    const tableBounds = table.tableBounds;
    this.viewRight = new Rectangle(
      tableBounds.right - IMAGE_BORDER_OFFSET,
      tableBounds.y,
      IMAGE_BORDER_WIDTH,
      tableBounds.height
    );
    this.viewBottom = new Rectangle(
      tableBounds.x,
      tableBounds.bottom - IMAGE_BORDER_OFFSET,
      tableBounds.width,
      IMAGE_BORDER_WIDTH
    );

    if (this.cellsSheet.sheetId === sheets.current) {
      pixiApp.setViewportDirty();
    }

    const end = sheets.sheet.getColumnRowFromScreen(tableBounds.right, tableBounds.bottom);
    this.sheet.gridOverflowLines.updateImageHtml(this.pos.x, this.pos.y, end.column - this.pos.x, end.row - this.pos.y);
    this.fitImage();
  };

  reposition() {
    const top = this.sheet.offsets.getRowHeight(this.pos.y);
    const table = this.table;
    this.position.set(table.tableBounds.left, table.tableBounds.top + top);
    this.resizeImage();
  }

  contains(world: Point): JsCoordinate | undefined {
    if (intersects.rectanglePoint(this.table.tableBounds, world)) {
      return { x: this.pos.x, y: this.pos.y };
    }
    return undefined;
  }

  isImageCell(x: number, y: number): boolean {
    const bounds = this.table.tableBounds;
    return x >= bounds.left && x < bounds.right && y >= bounds.top && y < bounds.bottom;
  }
}
