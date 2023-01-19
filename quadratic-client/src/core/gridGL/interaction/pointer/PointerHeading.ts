import { InteractivePointerEvent, Point } from 'pixi.js';
import { selectAllCells, selectColumns, selectRows } from '../../helpers/selectCellsAction';
import { zoomToFit } from '../../helpers/zoom';
import { PixiApp } from '../../pixiApp/PixiApp';
import { DOUBLE_CLICK_TIME } from './pointerUtils';
import { HeadingSize } from '../../../gridDB/useHeadings';

export class PointerHeading {
  private app: PixiApp;
  private active = false;
  private downTimeout: number | undefined;

  constructor(app: PixiApp) {
    this.app = app;
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
    const { headings, viewport, settings, cursor } = this.app;
    const { gridOffsets } = this.sheet;
    if (!settings.setInteractionState) {
      throw new Error('Expected pixiAppSettings.setInteractionState to be defined');
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
    return false;
  }

  pointerMove(world: Point): boolean {
    const { canvas, headings, cells, gridLines, cursor } = this.app;
    const { gridOffsets } = this.sheet;
    const headingResize = headings.intersectsHeadingGridLine(world);
    if (headingResize) {
      canvas.style.cursor = headingResize.column !== undefined ? 'col-resize' : 'row-resize';
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
          headings.dirty = true;
          this.app.quadrants.quadrantChanged({ column: gridOffsets.headingResizing.column });
        }
      } else if (gridOffsets.headingResizing.row !== undefined) {
        const size = Math.max(0, world.y - gridOffsets.headingResizing.start);
        if (size !== gridOffsets.headingResizing.height) {
          gridOffsets.headingResizing.height = size;
          cells.dirty = true;
          gridLines.dirty = true;
          cursor.dirty = true;
          headings.dirty = true;
          this.app.quadrants.quadrantChanged({ row: gridOffsets.headingResizing.row });
        }
      }
    }
    return true;
  }

  pointerUp(): boolean {
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
      }
      return true;
    }
    return false;
  }
}
