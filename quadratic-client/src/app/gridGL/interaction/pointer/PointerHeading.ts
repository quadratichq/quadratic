//! Checks for pointer hovering or pressed on the column and row headings.
//! 1. Resizing columns and rows
//! 2. Moving columns and rows (also triggered artificially from
//!    PointerCellMoving when clicking on the side of column/row selection)
//! 3. Selecting columns and rows
//! 4. Triggering context menu

import { hasPermissionToEditFile } from '@/app/actions';
import { ContextMenuType } from '@/app/atoms/contextMenuAtom';
import { PanMode } from '@/app/atoms/gridPanModeAtom';
import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { zoomToFit } from '@/app/gridGL/helpers/zoom';
import { inlineEditorHandler } from '@/app/gridGL/HTMLGrid/inlineEditor/inlineEditorHandler';
import { DOUBLE_CLICK_TIME } from '@/app/gridGL/interaction/pointer/pointerUtils';
import { content } from '@/app/gridGL/pixiApp/Content';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { pixiAppSettings } from '@/app/gridGL/pixiApp/PixiAppSettings';
import type { TransientResize } from '@/app/quadratic-core-types/index.js';
import { multiplayer } from '@/app/web-workers/multiplayerWebWorker/multiplayer';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { renderWebWorker } from '@/app/web-workers/renderWebWorker/renderWebWorker';
import { CELL_HEIGHT, CELL_TEXT_MARGIN_LEFT, CELL_WIDTH, MIN_CELL_WIDTH } from '@/shared/constants/gridConstants';
import { isMac } from '@/shared/utils/isMac';
import type { FederatedPointerEvent, Point } from 'pixi.js';

const MINIMUM_COLUMN_SIZE = 20;

export interface ColumnRowResize {
  index: number;
  size: number;
}

export interface ResizeHeadingColumnEvent extends CustomEvent {
  detail: number;
}

export class PointerHeading {
  private downTimeout: number | undefined;
  cursor?: string;
  private clicked = false;
  private fitToColumnTimeout?: number;

  active = false;

  private resizing?: {
    start: number;
    row: number | null;
    column: number | null;
    width?: number;
    height?: number;
    lastSize: number;
    oldSize: number;
  };

  movingColRows?: {
    isColumn: boolean;
    indicies: number[];
    start: number;
    place: number;
    offset: number;
  };

  // tracks changes to viewport caused by resizing negative column/row headings
  private viewportChanges = {
    change: 0,
    originalSize: 0,
    viewportStart: 0,
  };

  handleEscape(): boolean {
    if (this.movingColRows) {
      this.movingColRows = undefined;
      events.emit('setDirty', { cellMoving: true });
      pixiApp.viewport.disableMouseEdges();
    } else if (this.active) {
      sheets.sheet.offsets.cancelResize();
      if (this.resizing) {
        const delta = this.resizing.lastSize - this.resizing.oldSize;
        renderWebWorker.updateSheetOffsetsTransient(sheets.current, this.resizing.column, this.resizing.row, delta);
      }
      events.emit('setDirty', { gridLines: true, headings: true });
      this.active = false;
    } else {
      return false;
    }
    events.emit('setDirty', { cursor: true });
    pixiApp.setViewportDirty();
    return true;
  }

  pointerDown(world: Point, e: FederatedPointerEvent): boolean {
    clearTimeout(this.fitToColumnTimeout);

    const isRightClick = e.button === 2 || (isMac && e.button === 0 && e.ctrlKey);

    const viewport = pixiApp.viewport;
    const headings = content.headings;
    const intersects = headings.intersectsHeadings(world);
    if (!intersects) return false;

    // exit out of inline editor
    inlineEditorHandler.close({ skipFocusGrid: true });
    const cursor = sheets.sheet.cursor;

    const hasPermission = hasPermissionToEditFile(pixiAppSettings.editorInteractionState.permissions);
    const headingResize = !hasPermission ? undefined : headings.intersectsHeadingGridLine(world);
    if (headingResize) {
      pixiApp.setViewportDirty();
      if (this.clicked && headingResize.column !== null) {
        e.preventDefault();
        this.autoResizeColumn(headingResize.column);
        return true;
      } else if (this.clicked && headingResize.row !== null) {
        e.preventDefault();
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
        oldSize: this.viewportChanges.originalSize,
        start: headingResize.start,
        row: headingResize.row,
        column: headingResize.column,
        width: headingResize.width,
        height: headingResize.height,
      };
      this.active = true;
    } else if (
      !intersects.corner &&
      !isRightClick &&
      !cursor.isMultiRange() &&
      !cursor.isAllSelected() &&
      (intersects.column == null || cursor.isEntireColumnSelected(intersects.column)) &&
      (intersects.row == null || cursor.isEntireRowSelected(intersects.row))
    ) {
      const bounds = cursor.getInfiniteRefRangeBounds();
      const indicies = [];
      const isColumn = intersects.column !== null;
      const start = Number(isColumn ? bounds[0].start.col.coord : bounds[0].start.row.coord);
      const end = Number(isColumn ? bounds[0].end.col.coord : bounds[0].end.row.coord);
      for (let i = start; i <= end; i++) indicies.push(i);
      this.movingColRows = {
        isColumn,
        indicies,
        start,
        place: isColumn ? intersects.column! : intersects.row!,
        offset: (isColumn ? intersects.column! : intersects.row!) - start,
      };
      pixiApp.viewport.enableMouseEdges(world, isColumn ? 'horizontal' : 'vertical');
      events.emit('setDirty', { cellMoving: true });
      this.cursor = 'grabbing';
    } else if (intersects.corner) {
      if (this.downTimeout) {
        this.downTimeout = undefined;
        zoomToFit();
      } else {
        cursor.selectAll(e.shiftKey);
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
    const bounds = pixiApp.viewport.getVisibleBounds();
    const headingSize = content.headings.headingSize;
    if (intersects.column !== null) {
      const top = sheets.sheet.getRowFromScreen(bounds.top + headingSize.height);
      cursor.selectColumn(intersects.column, e.ctrlKey || e.metaKey, e.shiftKey, isRightClick, top);
    } else if (intersects.row !== null) {
      const left = sheets.sheet.getColumnFromScreen(bounds.left);
      cursor.selectRow(intersects.row, e.ctrlKey || e.metaKey, e.shiftKey, isRightClick, left);
    }
    if (isRightClick) {
      events.emit('contextMenu', {
        world,
        column: intersects.column ?? undefined,
        row: intersects.row ?? undefined,
        type: ContextMenuType.Grid,
      });
    }

    return true;
  }

  private pointerMoveColRows(world: Point, e?: FederatedPointerEvent): boolean {
    if (!this.movingColRows) {
      throw new Error('Expected movingColRows to be defined in pointerMoveColRows');
    }
    const { isColumn, place } = this.movingColRows;
    const current = sheets.sheet.getColumnRowFromScreen(world.x, world.y);

    // nothing to do if the pointer is still in the same column
    if ((isColumn ? current.column : current.row) === place) return true;

    // if the pointer is in a different column, we need to update the movingColRows
    this.movingColRows.place = isColumn ? current.column : current.row;
    events.emit('setDirty', { cellMoving: true });
    return true;
  }

  pointerMove(world: Point, e: FederatedPointerEvent): boolean {
    if (this.downTimeout) {
      window.clearTimeout(this.downTimeout);
      this.downTimeout = undefined;
    }

    if (this.movingColRows) {
      return this.pointerMoveColRows(world, e);
    }

    const { headings } = content;
    this.cursor = undefined;
    this.clicked = false;

    if (pixiAppSettings.panMode === PanMode.Disabled) {
      const hasPermission = hasPermissionToEditFile(pixiAppSettings.editorInteractionState.permissions);
      const headingResize = this.active ? this.resizing : headings.intersectsHeadingGridLine(world);
      if (hasPermission && headingResize) {
        this.cursor = headingResize.column !== null ? 'col-resize' : 'row-resize';
      } else {
        const result = headings.intersectsHeadings(world);
        if (result) {
          const cursor = sheets.sheet.cursor;
          if (
            !cursor.isMultiRange() &&
            !result.corner &&
            (result.column == null || cursor.isEntireColumnSelected(result.column)) &&
            (result.row == null || cursor.isEntireRowSelected(result.row))
          ) {
            this.cursor = 'grab';
          } else {
            this.cursor = 'pointer';
          }
        } else {
          this.cursor = undefined;
        }
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
            renderWebWorker.updateSheetOffsetsTransient(sheets.current, this.resizing.column, null, delta);
            events.emit('setDirty', { gridLines: true, headings: true, cursor: true });
            content.adjustHeadings({
              sheetId: sheets.current,
              column: this.resizing.column,
              row: null,
              delta: size - this.resizing.lastSize,
            });
          }
          this.resizing.lastSize = size;
          events.emit('resizeHeadingColumn', sheets.current, this.resizing.column);
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
            renderWebWorker.updateSheetOffsetsTransient(sheets.current, null, this.resizing.row, delta);
            events.emit('setDirty', { gridLines: true, headings: true, cursor: true });
            content.adjustHeadings({
              sheetId: sheets.current,
              column: null,
              row: this.resizing.row,
              delta: size - this.resizing.lastSize,
            });
          }
          this.resizing.lastSize = size;
          events.emit('resizeHeadingRow', sheets.current, this.resizing.row);
        }
      }
    }
    multiplayer.sendMouseMove(world.x, world.y);
    return true;
  }

  private pointerUpMovingColRows(): boolean {
    if (this.movingColRows) {
      if (this.movingColRows.place !== this.movingColRows.start && this.movingColRows.indicies.length >= 1) {
        if (this.movingColRows.isColumn) {
          quadraticCore.moveColumns(
            sheets.current,
            this.movingColRows.indicies[0],
            this.movingColRows.indicies[this.movingColRows.indicies.length - 1],
            this.movingColRows.place - this.movingColRows.offset
          );
        } else {
          quadraticCore.moveRows(
            sheets.current,
            this.movingColRows.indicies[0],
            this.movingColRows.indicies[this.movingColRows.indicies.length - 1],
            this.movingColRows.place - this.movingColRows.offset
          );
        }
      }
      this.movingColRows = undefined;
      events.emit('setDirty', { cellMoving: true });
      pixiApp.viewport.disableMouseEdges();
    }
    return true;
  }

  pointerUp(): boolean {
    if (this.movingColRows) {
      return this.pointerUpMovingColRows();
    }
    this.clicked = true;
    this.fitToColumnTimeout = window.setTimeout(() => {
      this.clicked = false;
    }, DOUBLE_CLICK_TIME);
    if (this.active) {
      this.active = false;
      if (this.resizing) {
        let columns = sheets.sheet.cursor.getSelectedColumns();
        if (this.resizing.column !== null) {
          if (!columns.includes(this.resizing.column)) {
            columns = [this.resizing.column];
          }
        }
        let rows = sheets.sheet.cursor.getSelectedRows();
        if (this.resizing.row !== null) {
          if (!rows.includes(this.resizing.row)) {
            rows = [this.resizing.row];
          }
        }
        if (sheets.sheet.cursor.isAllSelected()) {
          if (this.resizing.column && this.resizing.width !== undefined) {
            quadraticCore.resizeAllColumns(sheets.current, this.resizing.width);
          } else if (this.resizing.row && this.resizing.height !== undefined) {
            quadraticCore.resizeAllRows(sheets.current, this.resizing.height);
          }
        } else if (this.resizing.column && columns.length !== 1 && this.resizing.width !== undefined) {
          const size = this.resizing.width;
          const columnSizes = columns.map((column) => ({ index: column, size }));
          quadraticCore.resizeColumns(sheets.current, columnSizes);
        } else if (this.resizing.row && rows.length !== 1 && this.resizing.height !== undefined) {
          const size = this.resizing.height;
          const rowSizes = rows.map((row) => ({ index: row, size }));
          quadraticCore.resizeRows(sheets.current, rowSizes);
        }

        // otherwise work with the transient resize (if available)
        else {
          const transientResize = sheets.sheet.offsets.getResizeToApply();
          if (transientResize) {
            try {
              const { old_size, new_size } = JSON.parse(transientResize) as TransientResize;
              const delta = old_size - new_size;
              if (delta !== 0) {
                quadraticCore.commitTransientResize(sheets.current, transientResize);
              }
            } catch (error) {
              console.error('[PointerHeading] pointerUp: error parsing TransientResize: ', error);
            }
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
    const columns = sheets.sheet.cursor.getSelectedColumns();
    if (!columns.includes(column)) {
      columns.push(column);
    }
    const resizing: ColumnRowResize[] = [];
    for (const column of columns) {
      const maxWidth = await content.cellsSheets.getCellsContentMaxWidth(column);
      let size: number;
      if (maxWidth === 0) {
        size = CELL_WIDTH;
      } else {
        const contentSizePlusMargin = maxWidth + CELL_TEXT_MARGIN_LEFT * 3;
        size = Math.max(contentSizePlusMargin, MIN_CELL_WIDTH);
      }
      const originalSize = sheets.sheet.getCellOffsets(column, 0);
      if (originalSize.width !== size) {
        resizing.push({ index: column, size });
      }
    }
    if (resizing.length) {
      const sheetId = sheets.current;
      quadraticCore.resizeColumns(sheetId, resizing);
    }
  }

  async autoResizeRow(row: number) {
    const rows = sheets.sheet.cursor.getSelectedRows();
    if (!rows.includes(row)) {
      rows.push(row);
    }
    const resizing: ColumnRowResize[] = [];
    for (const row of rows) {
      const maxHeight = await content.cellsSheets.getCellsContentMaxHeight(row);
      const size = Math.max(maxHeight, CELL_HEIGHT);
      const originalSize = sheets.sheet.getCellOffsets(0, row);
      if (originalSize.height !== size) {
        resizing.push({ index: row, size });
      }
    }
    if (resizing.length) {
      const sheetId = sheets.current;
      quadraticCore.resizeRows(sheetId, resizing);
    }
  }
}
