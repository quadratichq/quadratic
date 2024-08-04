import { events } from '@/app/events/events';
import { inlineEditorHandler } from '@/app/gridGL/HTMLGrid/inlineEditor/inlineEditorHandler';
import { TransientResize } from '@/app/quadratic-core-types/index.js';
import { multiplayer } from '@/app/web-workers/multiplayerWebWorker/multiplayer';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { renderWebWorker } from '@/app/web-workers/renderWebWorker/renderWebWorker';
import { CELL_HEIGHT, CELL_TEXT_MARGIN_LEFT, CELL_WIDTH } from '@/shared/constants/gridConstants';
import { InteractivePointerEvent, Point } from 'pixi.js';
import { hasPermissionToEditFile } from '../../../actions';
import { sheets } from '../../../grid/controller/Sheets';
import { selectAllCells, selectColumns, selectRows } from '../../helpers/selectCells';
import { zoomToFit } from '../../helpers/zoom';
import { pixiApp } from '../../pixiApp/PixiApp';
import { PanMode, pixiAppSettings } from '../../pixiApp/PixiAppSettings';
import { DOUBLE_CLICK_TIME } from './pointerUtils';

const MINIMUM_COLUMN_SIZE = 20;

// minimum cell when resizing in 1 character
const MIN_CELL_WIDTH = 10;

// Returns an array with all numbers inclusive of start to end
function fillArray(start: number, end: number): number[] {
  const result = [];
  if (start > end) {
    [start, end] = [end, start];
  }
  for (let i = start; i <= end; i++) {
    result.push(i);
  }
  return result;
}

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

  pointerDown(world: Point, event: InteractivePointerEvent): boolean {
    clearTimeout(this.fitToColumnTimeout);
    const { headings, viewport } = pixiApp;
    const intersects = headings.intersectsHeadings(world);
    if (!intersects) return false;

    // exit out of inline editor
    inlineEditorHandler.closeIfOpen();

    const hasPermission = hasPermissionToEditFile(pixiAppSettings.editorInteractionState.permissions);
    const headingResize = !hasPermission ? undefined : headings.intersectsHeadingGridLine(world);
    if (headingResize) {
      pixiApp.setViewportDirty();
      if (this.clicked && headingResize.column !== undefined) {
        event.preventDefault();
        this.autoResizeColumn(headingResize.column);
        return true;
      } else if (this.clicked && headingResize.row !== undefined) {
        event.preventDefault();
        this.autoResizeRow(headingResize.row);
        return true;
      }
      this.viewportChanges = {
        change: 0,
        originalSize: headingResize.width ?? headingResize.height ?? 0,
        viewportStart: headingResize.row === undefined ? viewport.x : viewport.y,
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
          selectAllCells();
          this.downTimeout = window.setTimeout(() => {
            if (this.downTimeout) {
              this.downTimeout = undefined;
            }
          }, DOUBLE_CLICK_TIME);
        }
      }

      const cursor = sheets.sheet.cursor;

      // Selects multiple columns or rows. If ctrl/meta is pressed w/o shift,
      // then it add or removes the clicked column or row. If shift is pressed,
      // then it selects all columns or rows between the last clicked column or
      // row and the current one.
      if (event.ctrlKey || event.metaKey) {
        if (intersects.column !== undefined) {
          let column = intersects.column;
          const columns = cursor.columnRow?.columns || [];
          if (event.shiftKey) {
            if (columns.length === 0) {
              selectColumns([column], undefined, true);
            } else {
              const lastColumn = columns[columns.length - 1];
              if (lastColumn < column) {
                selectColumns([...columns, ...fillArray(lastColumn + 1, column)], undefined, true);
              } else {
                selectColumns([...columns, ...fillArray(column, lastColumn - 1)], undefined, true);
              }
            }
          } else {
            if (columns.includes(column)) {
              selectColumns(
                columns.filter((c) => c !== column),
                undefined,
                true
              );
            } else {
              selectColumns([...columns, column], undefined, true);
            }
          }
        } else if (intersects.row !== undefined) {
          let row = intersects.row;
          const rows = cursor.columnRow?.rows || [];
          if (event.shiftKey) {
            if (rows.length === 0) {
              selectRows([row], undefined, true);
            } else {
              const lastRow = rows[rows.length - 1];
              if (lastRow < row) {
                selectRows([...rows, ...fillArray(lastRow + 1, row)], undefined, true);
              } else {
                selectRows([...rows, ...fillArray(row, lastRow - 1)], undefined, true);
              }
            }
          } else {
            if (rows.includes(row)) {
              selectRows(
                rows.filter((c) => c !== row),
                undefined,
                true
              );
            } else {
              selectRows([...rows, row], undefined, true);
            }
          }
        }
      }

      // If a column/row is not selected, then it selects that column/row.
      // Otherwise it selects between the last selected column/row and the
      // current one.
      else if (event.shiftKey) {
        if (intersects.column !== undefined) {
          let x1 = cursor.cursorPosition.x;
          let x2 = intersects.column;
          selectColumns(fillArray(x1, x2), x1);
        } else if (intersects.row !== undefined) {
          let y1 = cursor.cursorPosition.y;
          let y2 = intersects.row;
          selectRows(fillArray(y1, y2), y1);
        }
      }

      // Otherwise, it selects the column/row.
      else {
        if (intersects.column !== undefined) {
          selectColumns([intersects.column]);
        } else if (intersects.row !== undefined) {
          selectRows([intersects.row]);
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
          const delta = this.resizing.width ? this.resizing.lastSize - this.resizing.width : undefined;
          if (delta) {
            renderWebWorker.updateSheetOffsetsTransient(sheets.sheet.id, this.resizing.column, undefined, delta);
            gridLines.dirty = true;
            cursor.dirty = true;
            headings.dirty = true;
            pixiApp.adjustHeadings({
              sheetId: sheets.sheet.id,
              column: this.resizing.column,
              delta: size - this.resizing.lastSize,
            });
          }
          this.resizing.lastSize = size;
          events.emit('resizeHeadingColumn', sheets.sheet.id, this.resizing.column);
        }
      } else if (this.resizing.row !== undefined) {
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
            renderWebWorker.updateSheetOffsetsTransient(sheets.sheet.id, undefined, this.resizing.row, delta);
            gridLines.dirty = true;
            cursor.dirty = true;
            headings.dirty = true;
            pixiApp.adjustHeadings({
              sheetId: sheets.sheet.id,
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
          // update remaining hashes hashes in render web worker, which were only updated in pixiApp
          try {
            const { column, row, old_size, new_size } = JSON.parse(transientResize) as TransientResize;
            const c = column !== null ? Number(column) : undefined;
            const r = row !== null ? Number(row) : undefined;
            const delta = old_size - new_size;
            if (delta !== 0) {
              renderWebWorker.updateSheetOffsetsFinal(sheets.sheet.id, c, r, delta);
              pixiApp.adjustHeadings({
                sheetId: sheets.sheet.id,
                column: c,
                row: r,
                delta,
              });
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
