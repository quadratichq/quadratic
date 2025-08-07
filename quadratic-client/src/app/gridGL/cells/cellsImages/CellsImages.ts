//! Draw the cell images (an Image output from a code cell)

import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { CellsImage } from '@/app/gridGL/cells/cellsImages/CellsImage';
import type { CellsSheet } from '@/app/gridGL/cells/CellsSheet';
import { intersects } from '@/app/gridGL/helpers/intersects';
import { isBitmapFontLoaded } from '@/app/gridGL/loadAssets';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import type { JsCoordinate } from '@/app/quadratic-core-types';
import type { CoreClientImage } from '@/app/web-workers/quadraticCore/coreClientMessages';
import type { Point, Rectangle } from 'pixi.js';
import { Container } from 'pixi.js';

export class CellsImages extends Container<CellsImage> {
  private cellsSheet: CellsSheet;

  constructor(cellsSheet: CellsSheet) {
    super();
    this.cellsSheet = cellsSheet;
    events.on('updateImage', this.updateImage);
    events.on('sheetOffsetsUpdated', this.reposition);
  }

  destroy() {
    events.off('updateImage', this.updateImage);
    events.off('sheetOffsetsUpdated', this.reposition);
    super.destroy();
  }

  reposition = (sheetId: string) => {
    if (this.cellsSheet.sheetId === sheetId) {
      this.children.forEach((sprite) => sprite.reposition());
    }
  };

  cheapCull(bounds: Rectangle) {
    this.children.forEach((cellsImage) => {
      cellsImage.visible = intersects.rectangleRectangle(bounds, cellsImage.table.tableBounds);
    });
  }

  private updateImage = (message: CoreClientImage) => {
    if (!isBitmapFontLoaded()) {
      events.once('bitmapFontsLoaded', () => this.updateImage(message));
      return;
    }

    if (message.sheetId === this.cellsSheet.sheetId) {
      let sprite = this.children.find(
        (sprite) => (sprite as CellsImage).pos.x === message.x && (sprite as CellsImage).pos.y === message.y
      );
      if (sprite) {
        if (message.image) {
          sprite.updateMessage(message);
        } else {
          sprite.destroy();
          this.removeChild(sprite);

          // remove the image from the overflow lines
          const sheet = sheets.getById(this.cellsSheet.sheetId);
          if (!sheet) throw new Error(`Expected sheet to be defined in CellsImages.updateImage`);
          sprite = undefined;
        }
      } else if (message.image) {
        this.addChild(new CellsImage(this.cellsSheet, message));
      }
      // pixiApp.cellImages.dirtyBorders = true;
      pixiApp.setViewportDirty();
    }
  };

  contains(world: Point): JsCoordinate | undefined {
    for (const child of this.children) {
      const result = child.contains(world);
      if (result) {
        return result;
      }
    }
  }

  // determines whether a column,row is inside the output of an image cell
  isImageCell(column: number, row: number): boolean {
    return this.children.some((child) => child.isImageCell(column, row));
  }

  // finds the image cell that contains a column,row
  findCodeCell(column: number, row: number): CellsImage | undefined {
    for (const image of this.children) {
      if (image.isImageCell(column, row)) {
        return image;
      }
    }
  }
}
