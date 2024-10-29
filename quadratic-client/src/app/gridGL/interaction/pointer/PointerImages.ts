import { hasPermissionToEditFile } from '@/app/actions';
import { CellsImage } from '@/app/gridGL/cells/cellsImages/CellsImage';
import { intersects } from '@/app/gridGL/helpers/intersects';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { pixiAppSettings } from '@/app/gridGL/pixiApp/PixiAppSettings';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { Point } from 'pixi.js';

const MIN_SIZE = 100;

export class PointerImages {
  resizing?: { image: CellsImage; point: Point; side: 'right' | 'bottom' | 'corner' };

  cursor: string | undefined;

  // Finds a line that is being hovered.
  private findImage(point: Point): { image: CellsImage; side?: 'right' | 'bottom' | 'corner' } | undefined {
    const cellsSheet = pixiApp.cellsSheets.current;
    if (!cellsSheet) return;
    const images = cellsSheet.getCellsImages();
    if (!images?.length) return;
    for (const image of images) {
      let right = intersects.rectanglePoint(image.viewRight, point);
      let bottom = intersects.rectanglePoint(image.viewBottom, point);
      if (right && bottom) return { image, side: 'corner' };
      if (right) return { image, side: 'right' };
      if (bottom) return { image, side: 'bottom' };
      if (intersects.rectanglePoint(image.viewBounds, point)) {
        return { image };
      }
    }
  }

  pointerMove(point: Point): boolean {
    if (!hasPermissionToEditFile(pixiAppSettings.editorInteractionState.permissions)) return false;

    if (this.resizing) {
      let width: number, height: number;
      const rightLarger =
        Math.abs(point.x - this.resizing.image.viewBounds.right) >
        Math.abs(point.y - this.resizing.image.viewBounds.bottom);
      if (this.resizing.side === 'right' || (this.resizing.side === 'corner' && rightLarger)) {
        width =
          this.resizing.image.viewBounds.right +
          (point.x - this.resizing.point.x) -
          this.resizing.image.viewBounds.left;
        const aspectRatio = width / this.resizing.image.viewBounds.width;
        height = this.resizing.image.viewBounds.height * aspectRatio;
      } else {
        height =
          this.resizing.image.viewBounds.bottom +
          (point.y - this.resizing.point.y) -
          this.resizing.image.viewBounds.top;
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
    if (search?.side) {
      pixiApp.cellImages.activate(search.image);
      switch (search.side) {
        case 'bottom':
          this.cursor = 'ns-resize';
          break;
        case 'right':
          this.cursor = 'ew-resize';
          break;
        case 'corner':
          this.cursor = 'nwse-resize';
          break;
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
