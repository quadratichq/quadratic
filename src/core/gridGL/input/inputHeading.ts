import { InteractivePointerEvent, Point } from 'pixi.js';
import { selectAllCells, selectColumns, selectRows } from '../helpers/selectCellsAction';
import { zoomToFit } from '../helpers/zoom';
import { PixiApp } from '../pixiApp/PixiApp';
import { DOUBLE_CLICK_TIME } from './inputUtils';
import { UpdateHeading, updateHeadingDB } from '../../gridDB/Cells/UpdateHeadingsDB';

export class inputHeading {
  private app: PixiApp;
  private active = false;
  private downTimeout: number | undefined;

  constructor(app: PixiApp) {
    this.app = app;
  }

  selectAll() {
    const { viewport, settings, cursor } = this.app;
    if (!settings.setInteractionState) return;
    selectAllCells({
      setInteractionState: settings.setInteractionState,
      interactionState: settings.interactionState,
      viewport,
    });
    cursor.dirty = true;
  }

  pointerDown(world: Point, event: InteractivePointerEvent): boolean {
    if (event.shiftKey) return false;
    const { headings, gridOffsets, viewport, settings, cursor } = this.app;
    if (!settings.setInteractionState) {
      console.warn('Expected pixiAppSettings.setInteractionState to be defined');
      return false;
    }
    const intersects = headings.intersectsHeadings(world);
    if (intersects) {
      const headingResize = headings.intersectsHeadingGridLine(world);
      if (headingResize) {
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
            zoomToFit(viewport);
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
            });
            cursor.dirty = true;
          }
        } else {
          selectAllCells({
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
    const { canvas, headings, gridOffsets, cells, gridLines, cursor } = this.app;
    const headingResize = headings.intersectsHeadingGridLine(world);
    if (headingResize) {
      canvas.style.cursor = headingResize.column !== undefined ? "col-resize" : "row-resize";
    } else {
      canvas.style.cursor = headings.intersectsHeadings(world) ? 'pointer' : 'auto';
    }
    if (!this.active) {
      return false;
    } else if (gridOffsets.headingResizing) {
      if (gridOffsets.headingResizing.column !== undefined) {
        const size = Math.max(0, world.x - gridOffsets.headingResizing.start);
        if (size !== gridOffsets.headingResizing.width) {
          gridOffsets.headingResizing.width = size;
          cells.dirty = true;
          gridLines.dirty = true;
          cursor.dirty = true;
        }
      } else if (gridOffsets.headingResizing.row !== undefined) {
        const size = Math.max(0, world.y - gridOffsets.headingResizing.start);
        if (size !== gridOffsets.headingResizing.height) {
          gridOffsets.headingResizing.height = size;
          cells.dirty = true;
          gridLines.dirty = true;
          cursor.dirty = true;
        }
      }
    }
    return true;
  }

  pointerUp(): boolean {
    if (this.active) {
      const { gridOffsets } = this.app;
      this.active = false;
      const { headingResizing } = gridOffsets;
      if (headingResizing) {
        let updateHeading: UpdateHeading | undefined;
        if (headingResizing.column !== undefined && headingResizing.width !== undefined) {
          updateHeading = {
            column: headingResizing.column,
            size: headingResizing.width,
          };
        }  else if (headingResizing.row !== undefined && headingResizing.height !== undefined) {
          updateHeading = {
            row: headingResizing.row,
            size: headingResizing.height,
          };
        }
        if (updateHeading) {
          updateHeadingDB(updateHeading);
          gridOffsets.optimisticUpdate(updateHeading)
        }
        gridOffsets.headingResizing = undefined;
      }
      return true;
    }
    return false;
  }
}