//! Draw the cell images (an Image output from a code cell)

import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { Coordinate } from '@/app/gridGL/types/size';
import { CoreClientImage } from '@/app/web-workers/quadraticCore/coreClientMessages';
import { Container, Point, Rectangle } from 'pixi.js';
import { intersects } from '../../helpers/intersects';
import { pixiApp } from '../../pixiApp/PixiApp';
import { CellsSheet } from '../CellsSheet';
import { CellsImage } from './CellsImage';

export class CellsImages extends Container<CellsImage> {
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

  reposition = (sheetId: string) => {
    if (this.cellsSheet.sheetId === sheetId) {
      this.children.forEach((sprite) => sprite.reposition());
    }
    // pixiApp.cellImages.dirtyBorders = true;
  };

  cheapCull(bounds: Rectangle) {
    this.children.forEach((sprite) => {
      sprite.visible = intersects.rectangleRectangle(bounds, sprite.viewBounds);
    });
  }

  private updateImage = (message: CoreClientImage) => {
    if (message.sheetId === this.cellsSheet.sheetId) {
      let sprite = this.children.find(
        (sprite) =>
          (sprite as CellsImage).gridBounds.x === message.x && (sprite as CellsImage).gridBounds.y === message.y
      );
      if (sprite) {
        if (message.image) {
          sprite.updateMessage(message);
        } else {
          this.removeChild(sprite);

          // remove the image from the overflow lines
          const sheet = sheets.getById(this.cellsSheet.sheetId);
          if (!sheet) throw new Error(`Expected sheet to be defined in CellsImages.updateImage`);
          sheet.gridOverflowLines.updateImageHtml(message.x, message.y);

          sprite = undefined;
        }
      } else if (message.image) {
        this.addChild(new CellsImage(this.cellsSheet, message));
      }
      // pixiApp.cellImages.dirtyBorders = true;
      pixiApp.setViewportDirty();
    }
  };

  contains(world: Point): Coordinate | undefined {
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
