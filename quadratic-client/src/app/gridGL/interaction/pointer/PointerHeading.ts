import { PanMode } from '@/app/atoms/gridPanModeAtom';
import { events } from '@/app/events/events';
import { inlineEditorHandler } from '@/app/gridGL/HTMLGrid/inlineEditor/inlineEditorHandler';
import { TransientResize } from '@/app/quadratic-core-types/index.js';
import { multiplayer } from '@/app/web-workers/multiplayerWebWorker/multiplayer';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { renderWebWorker } from '@/app/web-workers/renderWebWorker/renderWebWorker';
import { CELL_HEIGHT, CELL_TEXT_MARGIN_LEFT, CELL_WIDTH, MIN_CELL_WIDTH } from '@/shared/constants/gridConstants';
import { isMac } from '@/shared/utils/isMac';
import { InteractivePointerEvent, Point } from 'pixi.js';
import { hasPermissionToEditFile } from '../../../actions';
import { sheets } from '../../../grid/controller/Sheets';
import { zoomToFit } from '../../helpers/zoom';
import { pixiApp } from '../../pixiApp/PixiApp';
import { pixiAppSettings } from '../../pixiApp/PixiAppSettings';
import { DOUBLE_CLICK_TIME } from './pointerUtils';

const MINIMUM_COLUMN_SIZE = 20;

export interface ResizeHeadingColumnEvent extends CustomEvent {
  detail: number;
}
export class PointerHeading {
  private active = false;
  private downTimeout: number | undefined;
  cursor?: string;
  private clicked = false;
  private fitToColumnTimeout?: number;

  private resizing?: {
    start: number;
    row: number | null;
    column: number | null;
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

  pointerDown(world: Point, event: InteractivePointerEvent): boolean {
    clearTimeout(this.fitToColumnTimeout);
    const { headings, viewport } = pixiApp;
    const intersects = headings.intersectsHeadings(world);
    if (!intersects) return false;

    // exit out of inline editor
    inlineEditorHandler.closeIfOpen();
    const cursor = sheets.sheet.cursor;

    const hasPermission = hasPermissionToEditFile(pixiAppSettings.editorInteractionState.permissions);
    const headingResize = !hasPermission ? undefined : headings.intersectsHeadingGridLine(world);
    if (headingResize) {
      pixiApp.setViewportDirty();
      if (this.clicked && headingResize.column !== null) {
        event.preventDefault();
        this.autoResizeColumn(headingResize.column);
        return true;
      } else if (this.clicked && headingResize.row !== null) {
        event.preventDefault();
        this.autoResizeRow(headingResize.row);
        return true;
      }
      this.viewportChanges = {
        change: 0,
        originalSize: headingResize.width ?? headingResize.height ?? 0,
        viewportStart: headingResize.row === null ? viewport.x : viewport.y,
      };
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
          cursor.selectAll(event.shiftKey);
          this.downTimeout = window.setTimeout(() => {
            if (this.downTimeout) {
              this.downTimeout = undefined;
            }
          }, DOUBLE_CLICK_TIME);
        }
      }

      // Selects multiple columns or rows. If ctrl/meta is pressed w/o shift,
      // then it add or removes the clicked column or row. If shift is pressed,
      // then it selects all columns or rows between the last clicked column or
      // row and the current one.
      const isRightClick =
        (event as MouseEvent).button === 2 || (isMac && (event as MouseEvent).button === 0 && event.ctrlKey);
      const bounds = pixiApp.viewport.getVisibleBounds();
      const headingSize = pixiApp.headings.headingSize;
      if (intersects.column !== null) {
        const top = sheets.sheet.getRowFromScreen(bounds.top + headingSize.height);
        cursor.selectColumn(intersects.column, event.ctrlKey || event.metaKey, event.shiftKey, isRightClick, top);
      } else if (intersects.row !== null) {
        const left = sheets.sheet.getColumnFromScreen(bounds.left);
        cursor.selectRow(intersects.row, event.ctrlKey || event.metaKey, event.shiftKey, isRightClick, left);
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
        this.cursor = headingResize.column !== null ? 'col-resize' : 'row-resize';
      } else {
        this.cursor = headings.intersectsHeadings(world) ? 'pointer' : undefined;
      }
    }

    // Only style the heading resize cursor if panning mode is disabled
    if (!this.active) {
      return false;
    } else if (this.resizing) {
      const offsets = sheets.sheet.offsets;
      if (this.resizing.column !== null) {
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
          const delta = this.resizing.width ? this.resizing.lastSize - this.resizing.width : undefined;
          if (delta) {
            renderWebWorker.updateSheetOffsetsTransient(sheets.sheet.id, this.resizing.column, null, delta);
            gridLines.dirty = true;
            cursor.dirty = true;
            headings.dirty = true;
            pixiApp.adjustHeadings({
              sheetId: sheets.sheet.id,
              column: this.resizing.column,
              row: null,
              delta: size - this.resizing.lastSize,
            });
          }
          this.resizing.lastSize = size;
          events.emit('resizeHeadingColumn', sheets.sheet.id, this.resizing.column);
        }
      } else if (this.resizing.row !== null) {
        let size: number;
        if (this.resizing.row >= 0) {
          size = Math.max(MINIMUM_COLUMN_SIZE, world.y - this.resizing.start);
        } else {
          size = Math.max(MINIMUM_COLUMN_SIZE, world.y - this.resizing.start + this.viewportChanges.change);

          // move viewport by the amount of the resize for negative columns
          const change = size - this.viewportChanges.originalSize;
          pixiApp.viewport.y = this.viewportChanges.viewportStart + change * pixiApp.viewport.scale.y;
          this.viewportChanges.change = change;
        }

        if (size !== this.resizing.height) {
          this.resizing.height = size;
          offsets.resizeRowTransiently(this.resizing.row, size);
          const delta = this.resizing.height ? this.resizing.lastSize - this.resizing.height : undefined;
          if (delta) {
            renderWebWorker.updateSheetOffsetsTransient(sheets.sheet.id, null, this.resizing.row, delta);
            gridLines.dirty = true;
            cursor.dirty = true;
            headings.dirty = true;
            pixiApp.adjustHeadings({
              sheetId: sheets.sheet.id,
              column: null,
              row: this.resizing.row,
              delta: size - this.resizing.lastSize,
            });
          }
          this.resizing.lastSize = size;
          events.emit('resizeHeadingRow', sheets.sheet.id, this.resizing.row);
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
      if (this.resizing) {
        const transientResize = sheets.sheet.offsets.getResizeToApply();
        if (transientResize) {
          try {
            const { old_size, new_size } = JSON.parse(transientResize) as TransientResize;
            const delta = old_size - new_size;
            if (delta !== 0) {
              quadraticCore.commitTransientResize(sheets.sheet.id, transientResize);
            }
          } catch (error) {
            console.error('[PointerHeading] pointerUp: error parsing TransientResize: ', error);
          }
        }
        this.resizing = undefined;

        // fixes a bug where the viewport may still be decelerating
        pixiApp.viewport.plugins.get('decelerate')?.reset();
      }
      return true;
    }
    return false;
  }

  async autoResizeColumn(column: number) {
    const maxWidth = await pixiApp.cellsSheets.getCellsContentMaxWidth(column);
    let size: number;
    if (maxWidth === 0) {
      size = CELL_WIDTH;
    } else {
      const contentSizePlusMargin = maxWidth + CELL_TEXT_MARGIN_LEFT * 3;
      size = Math.max(contentSizePlusMargin, MIN_CELL_WIDTH);
    }
    const sheetId = sheets.sheet.id;
    const originalSize = sheets.sheet.getCellOffsets(column, 0);
    if (originalSize.width !== size) {
      quadraticCore.commitSingleResize(sheetId, column, undefined, size);
    }
  }

  async autoResizeRow(row: number) {
    const maxHeight = await pixiApp.cellsSheets.getCellsContentMaxHeight(row);
    const size = Math.max(maxHeight, CELL_HEIGHT);
    const sheetId = sheets.sheet.id;
    const originalSize = sheets.sheet.getCellOffsets(0, row);
    if (originalSize.height !== size) {
      quadraticCore.commitSingleResize(sheetId, undefined, row, size);
    }
  }
}
