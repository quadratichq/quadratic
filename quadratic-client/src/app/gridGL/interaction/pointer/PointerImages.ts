import { hasPermissionToEditFile } from '@/app/actions';
import { sheets } from '@/app/grid/controller/Sheets';
import type { CellsImage } from '@/app/gridGL/cells/cellsImages/CellsImage';
import type { Table } from '@/app/gridGL/cells/tables/Table';
import { intersects } from '@/app/gridGL/helpers/intersects';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { pixiAppSettings } from '@/app/gridGL/pixiApp/PixiAppSettings';
import { IMAGE_BORDER_OFFSET } from '@/app/gridGL/UI/UICellImages';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { Rectangle, type Point } from 'pixi.js';

// const MIN_SIZE = 100;
const CORNER_SIZE = 20;

export type ResizeSide = 'right' | 'bottom' | 'both';

interface Resizing {
  image: CellsImage;
  table: Table;
  point: Point;
  side: ResizeSide;
  originalWidth: number;
  originalHeight: number;
}

export class PointerImages {
  resizing?: Resizing;

  cursor: string | undefined;

  // Finds a line that is being hovered.
  private findImage(point: Point): { image: CellsImage; side?: ResizeSide } | undefined {
    const cellsSheet = pixiApp.cellsSheets.current;
    if (!cellsSheet) return;
    const images = cellsSheet.getCellsImages();
    if (!images?.length) return;
    for (const image of images) {
      const cornerSize = CORNER_SIZE * pixiApp.viewport.scaled;
      const bounds = image.table.tableBounds;
      const corner = new Rectangle(
        bounds.right - cornerSize,
        bounds.bottom - cornerSize,
        cornerSize + IMAGE_BORDER_OFFSET * 2,
        cornerSize + IMAGE_BORDER_OFFSET * 2
      );
      if (intersects.rectanglePoint(corner, point)) return { image, side: 'both' };
      let right = intersects.rectanglePoint(image.viewRight, point);
      let bottom = intersects.rectanglePoint(image.viewBottom, point);
      if (right && bottom) return { image, side: 'both' };
      if (right) return { image, side: 'right' };
      if (bottom) return { image, side: 'bottom' };
      if (intersects.rectanglePoint(bounds, point)) {
        return { image };
      }
    }
  }

  pointerMove(point: Point): boolean {
    if (!hasPermissionToEditFile(pixiAppSettings.editorInteractionState.permissions)) return false;

    if (this.resizing) {
      const image = this.resizing.image;
      const end = sheets.sheet.getColumnRowFromScreen(point.x, point.y);

      // ensure we're not into negative space
      end.column = Math.max(end.column, image.column);
      end.row = Math.max(end.row, image.row + 1);

      // if not corner, then keep the original width/height
      if (this.resizing.side === 'right') {
        end.row = image.table.tableBounds.bottom;
      } else if (this.resizing.side === 'bottom') {
        end.column = image.table.tableBounds.right;
      }
      const screenRectangle = sheets.sheet.getScreenRectangle(
        image.column,
        image.row,
        end.column - image.column + 1,
        end.row - image.row
      );
      this.resizing.image.temporaryResize(screenRectangle.width, screenRectangle.height);
      this.resizing.table.resize(screenRectangle.width, screenRectangle.height);
      pixiApp.cellImages.setDirty();
      pixiApp
        .cellsSheet()
        .tables.resizeTable(
          this.resizing.image.column,
          this.resizing.image.row,
          screenRectangle.width,
          screenRectangle.height
        );
      pixiApp.setViewportDirty();
      return true;
    }

    const search = this.findImage(point);
    if (search?.side) {
      pixiApp.cellImages.activate(search.image);
      if (search.side === 'bottom') {
        this.cursor = 'row-resize';
      } else if (search.side === 'right') {
        this.cursor = 'col-resize';
      } else if (search.side === 'both') {
        this.cursor = 'all-scroll';
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
    if (search && search.side) {
      const table = pixiApp.cellsSheet().tables.getTableFromTableCell(search.image.column, search.image.row);
      if (!table) {
        console.error('Table not found in PointerImages.pointerDown');
        return false;
      }
      this.resizing = {
        point,
        image: search.image,
        side: search.side,
        table,
        originalWidth: table.tableBounds.width,
        originalHeight: table.tableBounds.height,
      };
      pixiApp.cellImages.activate(search.image);
      return true;
    }
    return false;
  }

  pointerUp(): boolean {
    if (this.resizing) {
      const tableBounds = this.resizing.table.tableBounds;
      const end = sheets.sheet.getColumnRowFromScreen(tableBounds.right, tableBounds.bottom);
      quadraticCore.setCellRenderResize(
        this.resizing.image.sheetId,
        this.resizing.image.column,
        this.resizing.image.row,
        end.column - this.resizing.image.column,
        end.row - this.resizing.image.row - 1 // -1 to account for the chart name
      );
      this.resizing = undefined;
      return true;
    }
    return false;
  }

  handleEscape(): boolean {
    if (this.resizing) {
      this.resizing.image.width = this.resizing.originalWidth;
      this.resizing.image.height = this.resizing.originalHeight;
      pixiApp.cellImages.drawResizing();
      this.resizing = undefined;
      return true;
    }
    return false;
  }
}
