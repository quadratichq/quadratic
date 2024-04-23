import { hasPermissionToEditFile } from '@/actions';
import { CellsImage } from '@/gridGL/cells/cellsImages/CellsImage';
import { intersects } from '@/gridGL/helpers/intersects';
import { pixiApp } from '@/gridGL/pixiApp/PixiApp';
import { pixiAppSettings } from '@/gridGL/pixiApp/PixiAppSettings';
import { quadraticCore } from '@/web-workers/quadraticCore/quadraticCore';
import { Point } from 'pixi.js';

const MIN_SIZE = 100;

export class PointerImages {
  resizing?: { image: CellsImage; point: Point; side: 'right' | 'bottom' };

  cursor: string | undefined;

  // Finds a line that is being hovered.
  private findImage(point: Point): { image: CellsImage; side?: 'right' | 'bottom' } | undefined {
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
      if (intersects.rectanglePoint(image.viewBounds, point)) {
        return { image };
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
      this.resizing.image.temporaryResize(width, height);
      pixiApp.cellImages.dirtyResizing = true;
      pixiApp.cellImages.dirtyBorders = true;
      pixiApp.setViewportDirty();
      return true;
    }

    const search = this.findImage(point);
    if (search) {
      if (search.side) {
        pixiApp.cellImages.activate(search.image);
        this.cursor = search.side === 'bottom' ? 'ns-resize' : 'ew-resize';
      }
      return true;
    }
    pixiApp.cellImages.activate();
    this.cursor = undefined;
    return false;
  }

  pointerDown(point: Point): boolean {
    if (!hasPermissionToEditFile(pixiAppSettings.editorInteractionState.permissions)) return false;

    const search = this.findImage(point);
    if (search) {
      if (search.side) {
        this.resizing = { point, image: search.image, side: search.side };
        pixiApp.cellImages.activate(search.image);
      }
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
      this.resizing.image.resizeImage(this.resizing.image.width, this.resizing.image.height);
      this.resizing = undefined;
      return true;
    }
    return false;
  }

  handleEscape(): boolean {
    if (this.resizing) {
      this.resizing.image.width = this.resizing.image.viewBounds.width;
      this.resizing.image.height = this.resizing.image.viewBounds.height;
      pixiApp.cellImages.dirtyResizing = true;
      pixiApp.cellImages.dirtyBorders = true;
      this.resizing = undefined;
      return true;
    }
    return false;
  }
}
