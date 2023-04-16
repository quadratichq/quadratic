import { InteractivePointerEvent, Point } from 'pixi.js';
import { selectAllCells, selectColumns, selectRows } from '../../helpers/selectCells';
import { zoomToFit } from '../../helpers/zoom';
import { DOUBLE_CLICK_TIME } from './pointerUtils';
import { HeadingSize } from '../../../grid/sheet/useHeadings';
import { PanMode } from '../../../atoms/gridInteractionStateAtom';
import { PixiApp } from 'gridGL/pixiApp/PixiApp';

const MINIMUM_COLUMN_SIZE = 20;

export class PointerHeading {
  private app: PixiApp;
  private active = false;
  private downTimeout: number | undefined;

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
      const table = this.app.table;
      if (table) {
        table.sheet.gridOffsets.headingResizing = undefined;
        table.cells.dirty = true;
      }

      // todo...
      // this.app.gridLines.dirty = true;
      // this.app.cursor.dirty = true;
      this.app.headings.dirty = true;
      this.app.setViewportDirty();
      return true;
    }
    return false;
  }

  selectAll() {
    const { table, viewport, settings, cursor } = this.app;
    if (!table) return;
    if (!settings.setInteractionState) return;
    selectAllCells({
      sheet: table.sheet,
      setInteractionState: settings.setInteractionState,
      interactionState: settings.interactionState,
      viewport,
    });
    cursor.dirty = true;
  }

  pointerDown(world: Point, event: InteractivePointerEvent): boolean {
    const { table, headings, viewport, settings, cursor } = this.app;
    if (!table) return false;

    if (!settings.setInteractionState) {
      throw new Error('Expected pixiAppSettings.setInteractionState to be defined');
    }
    const intersects = headings.intersectsHeadings(world);
    if (intersects) {
      const headingResize = headings.intersectsHeadingGridLine(world);
      if (headingResize) {
        this.app.setViewportDirty();
        this.headingResizeViewport = {
          change: 0,
          originalSize: headingResize.width ?? headingResize.height ?? 0,
          viewportStart: headingResize.row === undefined ? viewport.x : viewport.y,
        };
        table.sheet.gridOffsets.headingResizing = {
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
            zoomToFit(table.sheet, viewport);
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
              sheet: table.sheet,
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
              sheet: table.sheet,
            });
            cursor.dirty = true;
          }
        } else {
          selectAllCells({
            sheet: table.sheet,
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
    return false;
  }

  pointerMove(world: Point): boolean {
    const { canvas, table, headings, cursor, settings } = this.app;
    if (!table) return false;

    // Only style the heading resize cursor if panning mode is disabled
    if (settings.interactionState.panMode === PanMode.Disabled) {
      const headingResize = headings.intersectsHeadingGridLine(world);
      if (headingResize) {
        canvas.style.cursor = headingResize.column !== undefined ? 'col-resize' : 'row-resize';
      } else {
        canvas.style.cursor = headings.intersectsHeadings(world) ? 'pointer' : 'unset';
      }
    }
    if (!this.active) {
      return false;
    } else if (table.sheet.gridOffsets.headingResizing) {
      const { headingResizing } = table.sheet.gridOffsets;
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
          table.cells.dirty = true;
          table.gridLines.dirty = true;
          cursor.dirty = true;
          headings.dirty = true;
          table.quadrants.quadrantChanged({ column: headingResizing.column });
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
          table.cells.dirty = true;
          table.gridLines.dirty = true;
          cursor.dirty = true;
          headings.dirty = true;
          table.quadrants.quadrantChanged({ row: headingResizing.row });
        }
      }
    }
    return true;
  }

  pointerUp(): boolean {
    if (this.active) {
      const { table } = this.app;
      if (!table) return false;

      this.active = false;
      const { sheet } = table;
      const { headingResizing } = sheet.gridOffsets;
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
        sheet.gridOffsets.headingResizing = undefined;
        this.app.viewport.plugins.get('decelerate')?.reset();
      }
      return true;
    }
    return false;
  }
}
