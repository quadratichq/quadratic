import { InteractivePointerEvent, Point } from 'pixi.js';
import { selectAllCells, selectColumns, selectRows } from '../../helpers/selectCells';
import { zoomToFit } from '../../helpers/zoom';
import { PixiApp } from '../../pixiApp/PixiApp';
import { DOUBLE_CLICK_TIME } from './pointerUtils';
import { HeadingSize } from '../../../grid/sheet/useHeadings';
import { PanMode } from '../../../atoms/gridInteractionStateAtom';
import { CELL_TEXT_MARGIN_LEFT } from '../../../constants/gridConstants';

const MINIMUM_COLUMN_SIZE = 20;

export class PointerHeading {
  private app: PixiApp;
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

  constructor(app: PixiApp) {
    this.app = app;
  }

  handleEscape(): boolean {
    if (this.active) {
      this.active = false;
      this.sheet.gridOffsets.headingResizing = undefined;
      this.app.cells.dirty = true;
      this.app.gridLines.dirty = true;
      this.app.cursor.dirty = true;
      this.app.headings.dirty = true;
      this.app.setViewportDirty();
      return true;
    }
    return false;
  }

  get sheet() {
    return this.app.sheet;
  }

  selectAll() {
    const { viewport, settings, cursor } = this.app;
    if (!settings.setInteractionState) return;
    selectAllCells({
      sheet: this.sheet,
      setInteractionState: settings.setInteractionState,
      interactionState: settings.interactionState,
      viewport,
    });
    cursor.dirty = true;
  }

  pointerDown(world: Point, event: InteractivePointerEvent): boolean {
    clearTimeout(this.fitToColumnTimeout);
    const { headings, viewport, settings, cursor } = this.app;
    const { gridOffsets } = this.sheet;
    if (!settings.setInteractionState) {
      throw new Error('Expected pixiAppSettings.setInteractionState to be defined');
    }
    const intersects = headings.intersectsHeadings(world);
    if (!intersects) return false;

    const headingResize = headings.intersectsHeadingGridLine(world);
    if (headingResize) {
      this.app.setViewportDirty();
      if (this.clicked && headingResize.column !== undefined) {
        this.onDoubleClick(headingResize.column);
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
          zoomToFit(this.sheet, viewport);
        } else {
          this.selectAll();
          this.downTimeout = window.setTimeout(() => {
            if (this.downTimeout) {
              this.downTimeout = undefined;
            }
          }, DOUBLE_CLICK_TIME);
        }
      }

      if (event.shiftKey) {
        if (intersects.column !== undefined) {
          let x1 = settings.interactionState.cursorPosition.x;
          let x2 = intersects.column;
          selectColumns({
            setInteractionState: settings.setInteractionState,
            interactionState: settings.interactionState,
            viewport,
            start: Math.min(x1, x2),
            end: Math.max(x1, x2),
            sheet: this.app.sheet,
          });
          cursor.dirty = true;
        } else if (intersects.row !== undefined) {
          let y1 = settings.interactionState.cursorPosition.y;
          let y2 = intersects.row;
          selectRows({
            setInteractionState: settings.setInteractionState,
            interactionState: settings.interactionState,
            viewport,
            start: Math.min(y1, y2),
            end: Math.max(y1, y2),
            sheet: this.app.sheet,
          });
          cursor.dirty = true;
        }
      } else {
        selectAllCells({
          sheet: this.sheet,
          setInteractionState: settings.setInteractionState,
          interactionState: settings.interactionState,
          viewport,
          column: intersects.column,
          row: intersects.row,
        });
        cursor.dirty = true;
      }
    }
    return true;
  }

  pointerMove(world: Point): boolean {
    const { headings, cells, gridLines, cursor, settings } = this.app;
    const { gridOffsets } = this.sheet;
    this.cursor = undefined;
    this.clicked = false;

    // Only style the heading resize cursor if panning mode is disabled
    if (settings.interactionState.panMode === PanMode.Disabled) {
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
          this.app.viewport.x = this.headingResizeViewport.viewportStart + change * this.app.viewport.scale.x;
          this.headingResizeViewport.change = change;
        }

        if (size !== headingResizing.width) {
          headingResizing.width = size;
          cells.dirty = true;
          gridLines.dirty = true;
          cursor.dirty = true;
          headings.dirty = true;
          this.app.quadrants.quadrantChanged({ column: headingResizing.column });
        }
      } else if (headingResizing.row !== undefined) {
        let size: number;
        if (headingResizing.row >= 0) {
          size = Math.max(MINIMUM_COLUMN_SIZE, world.y - headingResizing.start);
        } else {
          size = Math.max(MINIMUM_COLUMN_SIZE, world.y - headingResizing.start + this.headingResizeViewport.change);

          // move viewport by the amount of the resize for negative columns
          const change = size - this.headingResizeViewport.originalSize;
          this.app.viewport.y = this.headingResizeViewport.viewportStart + change * this.app.viewport.scale.x;
          this.headingResizeViewport.change = change;
        }

        if (size !== headingResizing.height) {
          headingResizing.height = size;
          cells.dirty = true;
          gridLines.dirty = true;
          cursor.dirty = true;
          headings.dirty = true;
          this.app.quadrants.quadrantChanged({ row: headingResizing.row });
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
          this.app.sheet_controller.predefined_transaction([
            {
              type: 'SET_HEADING_SIZE',
              data: {
                heading_size: updateHeading,
              },
            },
          ]);
        }
        gridOffsets.headingResizing = undefined;
        this.app.viewport.plugins.get('decelerate')?.reset();
      }
      return true;
    }
    return false;
  }

  private onDoubleClick(column: number): void {
    const cellsColumnContent = this.app.cells.getCellsContentWidth().filter((cell) => cell.location.x === column);

    if (cellsColumnContent.length === 0) return;
    const maxWidth = cellsColumnContent.reduce((max, cell) => (cell.textWidth > max ? cell.textWidth : max), 0);
    const contentSizePlusMargin = maxWidth + CELL_TEXT_MARGIN_LEFT * 3;
    const size = Math.max(contentSizePlusMargin, MINIMUM_COLUMN_SIZE);

    this.app.quadrants.quadrantChanged({ column });
    this.app.sheet_controller.predefined_transaction([
      {
        type: 'SET_HEADING_SIZE',
        data: {
          heading_size: {
            column,
            size,
          },
        },
      },
    ]);
  }
}
