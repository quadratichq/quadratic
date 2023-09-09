import { InteractivePointerEvent, Point } from 'pixi.js';
import { CELL_HEIGHT } from '../../../constants/gridConstants';
import { sheetController } from '../../../grid/controller/SheetController';
import { HeadingSize } from '../../../grid/sheet/useHeadings';
import { selectAllCells, selectColumns, selectRows } from '../../helpers/selectCells';
import { zoomToFit } from '../../helpers/zoom';
import { pixiApp } from '../../pixiApp/PixiApp';
import { PanMode } from '../../pixiApp/PixiAppSettings';
import { DOUBLE_CLICK_TIME } from './pointerUtils';

const MINIMUM_COLUMN_SIZE = 20;

export class PointerHeading {
  private active = false;
  private downTimeout: number | undefined;
  cursor?: string;
  private clicked = false;
  private fitToColumnTimeout?: number;

  // tracks changes to viewport caused by resizing negative column/row headings
  private headingResizeViewport = {
    change: 0,
    originalSize: 0,
    viewportStart: 0,
  };

  handleEscape(): boolean {
    if (this.active) {
      this.active = false;
      this.sheet.gridOffsets.headingResizing = undefined;
      // pixiApp.cells.dirty = true;
      pixiApp.gridLines.dirty = true;
      pixiApp.cursor.dirty = true;
      pixiApp.headings.dirty = true;
      pixiApp.setViewportDirty();
      return true;
    }
    return false;
  }

  get sheet() {
    return sheetController.sheet;
  }

  selectAll() {
    const { cursor } = pixiApp;
    selectAllCells();
    cursor.dirty = true;
  }

  pointerDown(world: Point, event: InteractivePointerEvent): boolean {
    clearTimeout(this.fitToColumnTimeout);
    const { headings, viewport } = pixiApp;
    const { gridOffsets } = this.sheet;
    const intersects = headings.intersectsHeadings(world);
    if (!intersects) return false;

    const headingResize = headings.intersectsHeadingGridLine(world);
    if (headingResize) {
      pixiApp.setViewportDirty();
      if (this.clicked && headingResize.column !== undefined) {
        this.onDoubleClickColumn(headingResize.column);
        return true;
      } else if (this.clicked && headingResize.row !== undefined) {
        this.onDoubleClickRow(headingResize.row);
        return true;
      }
      this.headingResizeViewport = {
        change: 0,
        originalSize: headingResize.width ?? headingResize.height ?? 0,
        viewportStart: headingResize.row === undefined ? viewport.x : viewport.y,
      };
      gridOffsets.headingResizing = {
        x: world.x,
        y: world.y,
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

      const cursor = this.sheet.cursor;

      if (event.shiftKey) {
        if (intersects.column !== undefined) {
          let x1 = cursor.cursorPosition.x;
          let x2 = intersects.column;
          selectColumns({
            start: Math.min(x1, x2),
            end: Math.max(x1, x2),
          });
          pixiApp.cursor.dirty = true;
        } else if (intersects.row !== undefined) {
          let y1 = cursor.cursorPosition.y;
          let y2 = intersects.row;
          selectRows({
            start: Math.min(y1, y2),
            end: Math.max(y1, y2),
          });
          pixiApp.cursor.dirty = true;
        }
      } else {
        selectAllCells(intersects.column, intersects.row);
        pixiApp.cursor.dirty = true;
      }
    }
    return true;
  }

  pointerMove(world: Point): boolean {
    const { headings, gridLines, cursor } = pixiApp;
    const { gridOffsets } = this.sheet;
    this.cursor = undefined;
    this.clicked = false;

    // Only style the heading resize cursor if panning mode is disabled
    if (pixiApp.settings.panMode === PanMode.Disabled) {
      const headingResize = headings.intersectsHeadingGridLine(world);
      if (headingResize) {
        this.cursor = headingResize.column !== undefined ? 'col-resize' : 'row-resize';
      } else {
        this.cursor = headings.intersectsHeadings(world) ? 'pointer' : undefined;
      }
    }
    if (!this.active) {
      return false;
    } else if (gridOffsets.headingResizing) {
      const { headingResizing } = gridOffsets;
      if (headingResizing.column !== undefined) {
        let size: number;
        if (headingResizing.column >= 0) {
          size = Math.max(MINIMUM_COLUMN_SIZE, world.x - headingResizing.start);
        } else {
          size = Math.max(MINIMUM_COLUMN_SIZE, world.x - headingResizing.start + this.headingResizeViewport.change);

          // move viewport by the amount of the resize for negative columns
          const change = size - this.headingResizeViewport.originalSize;
          pixiApp.viewport.x = this.headingResizeViewport.viewportStart + change * pixiApp.viewport.scale.x;
          this.headingResizeViewport.change = change;
        }

        if (size !== headingResizing.width) {
          headingResizing.width = size;
          // cells.dirty = true;
          gridLines.dirty = true;
          cursor.dirty = true;
          headings.dirty = true;

          // todo fix this
          // pixiApp.cellsSheets.changed({ column: headingResizing.column, labels: true, background: true });
          // pixiApp.quadrants.quadrantChanged({ column: headingResizing.column });
        }
      } else if (headingResizing.row !== undefined) {
        let size: number;
        if (headingResizing.row >= 0) {
          size = Math.max(MINIMUM_COLUMN_SIZE, world.y - headingResizing.start);
        } else {
          size = Math.max(MINIMUM_COLUMN_SIZE, world.y - headingResizing.start + this.headingResizeViewport.change);

          // move viewport by the amount of the resize for negative columns
          const change = size - this.headingResizeViewport.originalSize;
          pixiApp.viewport.y = this.headingResizeViewport.viewportStart + change * pixiApp.viewport.scale.x;
          this.headingResizeViewport.change = change;
        }

        if (size !== headingResizing.height) {
          headingResizing.height = size;
          // cells.dirty = true;
          gridLines.dirty = true;
          cursor.dirty = true;
          headings.dirty = true;

          // todo fix this
          // pixiApp.cellsSheets.changed({ row: headingResizing.row, labels: true, background: true });
          // pixiApp.quadrants.quadrantChanged({ row: headingResizing.row });
        }
      }
    }
    return true;
  }

  pointerUp(): boolean {
    this.clicked = true;
    this.fitToColumnTimeout = window.setTimeout(() => {
      this.clicked = false;
    }, DOUBLE_CLICK_TIME);
    if (this.active) {
      const { gridOffsets } = this.sheet;
      this.active = false;
      const { headingResizing } = gridOffsets;
      if (headingResizing) {
        let updateHeading: HeadingSize | undefined;
        if (headingResizing.column !== undefined && headingResizing.width !== undefined) {
          updateHeading = {
            column: headingResizing.column,
            size: headingResizing.width,
          };
        } else if (headingResizing.row !== undefined && headingResizing.height !== undefined) {
          updateHeading = {
            row: headingResizing.row,
            size: headingResizing.height,
          };
        }
        if (updateHeading) {
          sheetController.predefined_transaction([
            {
              type: 'SET_HEADING_SIZE',
              data: {
                heading_size: updateHeading,
              },
            },
          ]);
        }
        gridOffsets.headingResizing = undefined;
        pixiApp.viewport.plugins.get('decelerate')?.reset();
      }
      return true;
    }
    return false;
  }

  private onDoubleClickColumn(column: number): void {
    // todo
    // const cellsColumnContent = pixiApp.cells.getCellsContentWidth().filter((cell) => cell.location.x === column);
    // if (cellsColumnContent.length === 0) return;
    // const maxWidth = cellsColumnContent.reduce((max, cell) => (cell.textWidth > max ? cell.textWidth : max), 0);
    // const contentSizePlusMargin = maxWidth + CELL_TEXT_MARGIN_LEFT * 3;
    // const size = Math.max(contentSizePlusMargin, MINIMUM_COLUMN_SIZE);
    // pixiApp.quadrants.quadrantChanged({ column });
    // pixiApp.sheet_controller.predefined_transaction([
    //   {
    //     type: 'SET_HEADING_SIZE',
    //     data: {
    //       heading_size: {
    //         column,
    //         size,
    //       },
    //     },
    //   },
    // ]);
  }

  private onDoubleClickRow(row: number): void {
    // todo when rows have content...
    // const cellsColumnContent = pixiApp.cells.getCellsContentWidth().filter((cell) => cell.location.x === column);
    // if (cellsColumnContent.length === 0) return;
    // const maxWidth = cellsColumnContent.reduce((max, cell) => (cell.textWidth > max ? cell.textWidth : max), 0);
    // const contentSizePlusMargin = maxWidth + CELL_TEXT_MARGIN_LEFT * 3;
    // const size = Math.max(contentSizePlusMargin, MINIMUM_COLUMN_SIZE);

    const size = CELL_HEIGHT;

    pixiApp.quadrants.quadrantChanged({ row });
    sheetController.predefined_transaction([
      {
        type: 'SET_HEADING_SIZE',
        data: {
          heading_size: {
            row,
            size,
          },
        },
      },
    ]);
  }
}
