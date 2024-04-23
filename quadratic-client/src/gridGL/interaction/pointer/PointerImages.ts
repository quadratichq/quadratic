import { hasPermissionToEditFile } from '@/actions';
import { SpriteImage } from '@/gridGL/cells/CellsImages';
import { intersects } from '@/gridGL/helpers/intersects';
import { pixiApp } from '@/gridGL/pixiApp/PixiApp';
import { pixiAppSettings } from '@/gridGL/pixiApp/PixiAppSettings';
import { quadraticCore } from '@/web-workers/quadraticCore/quadraticCore';
import { Point } from 'pixi.js';

const MIN_SIZE = 100;

export class PointerImages {
  resizing?: { image: SpriteImage; point: Point; side: 'right' | 'bottom' };

  cursor: string | undefined;

  // Finds a line that is being hovered.
  private findLine(point: Point): { image: SpriteImage; side: 'right' | 'bottom' } | undefined {
    const cellsSheet = pixiApp.cellsSheets.current;
    if (!cellsSheet) return;
    const images = cellsSheet.getCellsImages();
    if (!images?.length) return;
    for (const image of images) {
      if (intersects.rectanglePoint(image.viewRight, point)) {
        return { image, side: 'right' };
      }
      if (intersects.rectanglePoint(image.viewBottom, point)) {
        return { image, side: 'bottom' };
      }
    }
  }

  pointerMove(point: Point): boolean {
    if (!hasPermissionToEditFile(pixiAppSettings.editorInteractionState.permissions)) return false;

    if (this.resizing) {
      let width: number, height: number;
      if (this.resizing.side === 'right') {
        width = point.x - (this.resizing.image.viewBounds.right - this.resizing.point.x);
        const aspectRatio = width / this.resizing.image.viewBounds.width;
        height = this.resizing.image.viewBounds.height * aspectRatio;
      } else {
        height = point.y - (this.resizing.image.viewBounds.bottom - this.resizing.point.y);
        const aspectRatio = height / this.resizing.image.viewBounds.height;
        width = this.resizing.image.viewBounds.width * aspectRatio;
      }
      if (width < MIN_SIZE) {
        width = MIN_SIZE;
        const aspectRatio = width / this.resizing.image.viewBounds.width;
        height = this.resizing.image.viewBounds.height * aspectRatio;
      }
      if (height < MIN_SIZE) {
        height = MIN_SIZE;
        const aspectRatio = height / this.resizing.image.viewBounds.height;
        width = this.resizing.image.viewBounds.width * aspectRatio;
      }
      this.resizing.image.width = width;
      this.resizing.image.height = height;
      pixiApp.uiImageResize.draw();
      pixiApp.setViewportDirty();
      return true;
    }

    const line = this.findLine(point);
    if (line) {
      pixiApp.uiImageResize.activate(line.image);
      this.cursor = line.side === 'bottom' ? 'row-resize' : 'col-resize';
      return true;
    }
    pixiApp.uiImageResize.activate();
    this.cursor = undefined;
    return false;
  }

  pointerDown(point: Point): boolean {
    if (!hasPermissionToEditFile(pixiAppSettings.editorInteractionState.permissions)) return false;

    const line = this.findLine(point);
    if (line) {
      this.resizing = { point, image: line.image, side: line.side };
      pixiApp.uiImageResize.activate(line.image);
      return true;
    }
    return false;
  }

  pointerUp(): boolean {
    if (this.resizing) {
      quadraticCore.setCellRenderResize(
        this.resizing.image.sheetId,
        this.resizing.image.column,
        this.resizing.image.row,
        this.resizing.image.width,
        this.resizing.image.height
      );
      pixiApp.cellsSheets.current?.cellsImages.resizeImage(this.resizing.image);
      this.resizing = undefined;
      return true;
    }
    return false;
  }

  handleEscape(): boolean {
    if (this.resizing) {
      this.resizing.image.width = this.resizing.image.viewBounds.width;
      this.resizing.image.height = this.resizing.image.viewBounds.height;
      pixiApp.uiImageResize.draw();
      this.resizing = undefined;
      return true;
    }
    return false;
  }
}
