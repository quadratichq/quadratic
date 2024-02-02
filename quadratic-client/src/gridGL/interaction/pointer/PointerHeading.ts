import { multiplayer } from '@/multiplayer/multiplayer';
import { InteractivePointerEvent, Point } from 'pixi.js';
import { hasPermissionToEditFile } from '../../../actions';
import { CELL_TEXT_MARGIN_LEFT, CELL_WIDTH } from '../../../constants/gridConstants';
import { grid } from '../../../grid/controller/Grid';
import { sheets } from '../../../grid/controller/Sheets';
import { selectAllCells, selectColumns, selectRows } from '../../helpers/selectCells';
import { zoomToFit } from '../../helpers/zoom';
import { pixiApp } from '../../pixiApp/PixiApp';
import { PanMode, pixiAppSettings } from '../../pixiApp/PixiAppSettings';
import { DOUBLE_CLICK_TIME } from './pointerUtils';

const MINIMUM_COLUMN_SIZE = 20;

export class PointerHeading {
  private active = false;
  private downTimeout: number | undefined;
  cursor?: string;
  private clicked = false;
  private fitToColumnTimeout?: number;

  private resizing?: {
    start: number;
    row?: number;
    column?: number;
    width?: number;
    height?: number;
    lastSize: number;
  };

  // tracks changes to viewport caused by resizing negative column/row headings
  private viewportChanges = {
    change: 0,
    originalSize: 0,
    viewportStart: 0,
  };

  handleEscape(): boolean {
    if (this.active) {
      this.active = false;
      sheets.sheet.offsets.cancelResize();
      pixiApp.gridLines.dirty = true;
      pixiApp.cursor.dirty = true;
      pixiApp.headings.dirty = true;
      pixiApp.setViewportDirty();
      return true;
    }
    return false;
  }

  selectAll() {
    const { cursor } = pixiApp;
    selectAllCells();
    cursor.dirty = true;
  }

  pointerDown(world: Point, event: InteractivePointerEvent): boolean {
    clearTimeout(this.fitToColumnTimeout);
    const { headings, viewport } = pixiApp;
    const intersects = headings.intersectsHeadings(world);
    if (!intersects) return false;

    const hasPermission = hasPermissionToEditFile(pixiAppSettings.editorInteractionState.permissions);
    const headingResize = !hasPermission ? undefined : headings.intersectsHeadingGridLine(world);
    if (headingResize) {
      pixiApp.setViewportDirty();
      if (this.clicked && headingResize.column !== undefined) {
        this.onDoubleClickColumn(headingResize.column);
        event.preventDefault();
        return true;
      } else if (this.clicked && headingResize.row !== undefined) {
        this.onDoubleClickRow(headingResize.row);
        event.preventDefault();
        return true;
      }
      this.viewportChanges = {
        change: 0,
        originalSize: headingResize.width ?? headingResize.height ?? 0,
        viewportStart: headingResize.row === undefined ? viewport.x : viewport.y,
      };
      const offsets = sheets.sheet.offsets;
      if (headingResize.column !== undefined) {
        offsets.resizeColumnTransiently(headingResize.column, headingResize.width);
      } else if (headingResize.row !== undefined) {
        offsets.resizeRowTransiently(headingResize.row, headingResize.height);
      }
      this.resizing = {
        lastSize: this.viewportChanges.originalSize,
        start: headingResize.start,
        row: headingResize.row,
        column: headingResize.column,
        width: headingResize.width,
        height: headingResize.height,
      };
      this.active = true;
    } else {
      if (intersects.corner) {
        if (this.downTimeout) {
          this.downTimeout = undefined;
          zoomToFit();
        } else {
          this.selectAll();
          this.downTimeout = window.setTimeout(() => {
            if (this.downTimeout) {
              this.downTimeout = undefined;
            }
          }, DOUBLE_CLICK_TIME);
        }
      }

      const cursor = sheets.sheet.cursor;

      if (event.shiftKey) {
        if (intersects.column !== undefined) {
          let x1 = cursor.cursorPosition.x;
          let x2 = intersects.column;
          selectColumns(Math.min(x1, x2), Math.max(x1, x2));
          pixiApp.cursor.dirty = true;
        } else if (intersects.row !== undefined) {
          let y1 = cursor.cursorPosition.y;
          let y2 = intersects.row;
          selectRows(Math.min(y1, y2), Math.max(y1, y2));
          pixiApp.cursor.dirty = true;
        }
      } else {
        if (intersects.column !== undefined) {
          selectColumns(intersects.column, intersects.column);
        } else if (intersects.row !== undefined) {
          selectRows(intersects.row, intersects.row);
        }
      }
    }
    return true;
  }

  pointerMove(world: Point): boolean {
    if (this.downTimeout) {
      window.clearTimeout(this.downTimeout);
      this.downTimeout = undefined;
    }
    const { headings, gridLines, cursor } = pixiApp;
    this.cursor = undefined;
    this.clicked = false;

    if (pixiAppSettings.panMode === PanMode.Disabled) {
      const hasPermission = hasPermissionToEditFile(pixiAppSettings.editorInteractionState.permissions);
      const headingResize = this.active ? this.resizing : headings.intersectsHeadingGridLine(world);
      if (hasPermission && headingResize) {
        this.cursor = headingResize.column !== undefined ? 'col-resize' : 'row-resize';
      } else {
        this.cursor = headings.intersectsHeadings(world) ? 'pointer' : undefined;
      }
    }

    // Only style the heading resize cursor if panning mode is disabled
    if (!this.active) {
      return false;
    } else if (this.resizing) {
      const offsets = sheets.sheet.offsets;
      if (this.resizing.column !== undefined) {
        let size: number;
        if (this.resizing.column >= 0) {
          size = Math.max(MINIMUM_COLUMN_SIZE, world.x - this.resizing.start);
        } else {
          size = Math.max(MINIMUM_COLUMN_SIZE, world.x - this.resizing.start + this.viewportChanges.change);

          // move viewport by the amount of the resize for negative columns
          const change = size - this.viewportChanges.originalSize;
          pixiApp.viewport.x = this.viewportChanges.viewportStart + change * pixiApp.viewport.scale.x;
          this.viewportChanges.change = change;
        }

        if (size !== this.resizing.width) {
          this.resizing.width = size;
          offsets.resizeColumnTransiently(this.resizing.column, size);
          gridLines.dirty = true;
          cursor.dirty = true;
          headings.dirty = true;

          pixiApp.adjustHeadings({
            sheetId: sheets.sheet.id,
            column: this.resizing.column,
            delta: size - this.resizing.lastSize,
          });
          this.resizing.lastSize = size;
        }
      } else if (this.resizing.row !== undefined) {
        let size: number;
        if (this.resizing.row >= 0) {
          size = Math.max(MINIMUM_COLUMN_SIZE, world.y - this.resizing.start);
        } else {
          size = Math.max(MINIMUM_COLUMN_SIZE, world.y - this.resizing.start + this.viewportChanges.change);

          // move viewport by the amount of the resize for negative columns
          const change = size - this.viewportChanges.originalSize;
          pixiApp.viewport.y = this.viewportChanges.viewportStart + change * pixiApp.viewport.scale.x;
          this.viewportChanges.change = change;
        }

        if (size !== this.resizing.height) {
          this.resizing.height = size;
          offsets.resizeRowTransiently(this.resizing.row, size);
          gridLines.dirty = true;
          cursor.dirty = true;
          headings.dirty = true;

          pixiApp.adjustHeadings({
            sheetId: sheets.sheet.id,
            row: this.resizing.row,
            delta: size - this.resizing.lastSize,
          });
          this.resizing.lastSize = size;
        }
      }
    }
    multiplayer.sendMouseMove(world.x, world.y);
    return true;
  }

  pointerUp(): boolean {
    this.clicked = true;
    this.fitToColumnTimeout = window.setTimeout(() => {
      this.clicked = false;
    }, DOUBLE_CLICK_TIME);
    if (this.active) {
      this.active = false;
      const { resizing: headingResizing } = this;
      if (headingResizing) {
        const transientResize = sheets.sheet.offsets.getResizeToApply();
        if (transientResize) {
          grid.commitTransientResize(sheets.sheet.id, transientResize);
        }
        this.resizing = undefined;

        // fixes a bug where the viewport may still be decelerating
        pixiApp.viewport.plugins.get('decelerate')?.reset();
      }
      return true;
    }
    return false;
  }

  private onDoubleClickColumn(column: number): void {
    const maxWidth = pixiApp.cellsSheets.getCellsContentMaxWidth(column);
    const contentSizePlusMargin = maxWidth + CELL_TEXT_MARGIN_LEFT * 3;
    const size = Math.max(contentSizePlusMargin, CELL_WIDTH);
    const sheetId = sheets.sheet.id;
    const originalSize = sheets.sheet.getCellOffsets(column, 0);
    if (originalSize.width !== size) {
      grid.commitSingleResize(sheetId, column, undefined, size);
    }
  }

  private onDoubleClickRow(row: number): void {
    // todo when rows have wrapping...
  }
}
