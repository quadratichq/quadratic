import { Container } from 'pixi.js';
import type { Rectangle } from 'pixi.js';

import { events } from '@/app/events/events';
import { CellsImage } from '@/app/gridGL/cells/cellsImages/CellsImage';
import type { CellsSheet } from '@/app/gridGL/cells/CellsSheet';
import { intersects } from '@/app/gridGL/helpers/intersects';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import type { CoreClientImage } from '@/app/web-workers/quadraticCore/coreClientMessages';

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
  };

  cheapCull(bounds: Rectangle) {
    this.children.forEach((sprite) => {
      sprite.visible = intersects.rectangleRectangle(bounds, sprite.viewBounds);
    });
  }

  private updateImage = (message: CoreClientImage) => {
    if (message.sheetId === this.cellsSheet.sheetId) {
      let sprite = this.children.find(
        (sprite) => (sprite as CellsImage).column === message.x && (sprite as CellsImage).row === message.y
      );
      if (sprite) {
        if (message.image) {
          sprite.updateMessage(message);
        } else {
          this.removeChild(sprite);
          sprite = undefined;
        }
      } else if (message.image) {
        this.addChild(new CellsImage(this.cellsSheet, message));
      }
      pixiApp.cellImages.dirtyBorders = true;
      pixiApp.setViewportDirty();
    }
  };
}
