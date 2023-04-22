/* eslint-disable @typescript-eslint/no-unused-vars */
import { Point, Rectangle } from 'pixi.js';
import { IS_READONLY_MODE } from '../../../../constants/app';
import { PixiApp } from '../../../pixiApp/PixiApp';
import { Sheet } from '../../../../grid/sheet/Sheet';
import { PanMode } from '../../../../atoms/gridInteractionStateAtom';
import { intersects } from '../../../helpers/intersects';
import { Coordinate } from '../../../types/size';
import { expandDown, expandLeft, expandRight, expandUp, shrinkHorizontal, shrinkVertical } from './autoComplete';

type State =
  | 'expandDown'
  | 'expandUp'
  | 'expandRight'
  | 'expandLeft'
  | 'shrinkVertical'
  | 'shrinkHorizontal'
  | undefined;

export class PointerAutoComplete {
  private app: PixiApp;
  private state: State;
  private selection?: Rectangle;
  private endCell?: Coordinate;
  private boxCells?: Rectangle;
  private screenSelection?: Rectangle;
  cursor?: string;
  active = false;

  constructor(app: PixiApp) {
    this.app = app;
  }

  get sheet(): Sheet {
    return this.app.sheet;
  }

  pointerDown(world: Point): boolean {
    if (IS_READONLY_MODE) return false;
    const { interactionState, setInteractionState } = this.app.settings;
    if (!setInteractionState) throw new Error('Expected setInteractionState to be defined in PointerAutoComplete');
    if (interactionState.panMode !== PanMode.Disabled) return false;

    // handle dragging from the corner
    if (intersects.rectanglePoint(this.app.cursor.indicator, world)) {
      this.active = true;
      if (interactionState.multiCursorPosition) {
        this.selection = new Rectangle(
          interactionState.multiCursorPosition.originPosition.x,
          interactionState.multiCursorPosition.originPosition.y,
          interactionState.multiCursorPosition.terminalPosition.x -
            interactionState.multiCursorPosition.originPosition.x,
          interactionState.multiCursorPosition.terminalPosition.y -
            interactionState.multiCursorPosition.originPosition.y
        );
      } else {
        this.selection = new Rectangle(interactionState.cursorPosition.x, interactionState.cursorPosition.y, 1, 1);
      }
      this.screenSelection = this.app.sheet.gridOffsets.getScreenRectangle(
        this.selection.left,
        this.selection.top,
        this.selection.width + 1,
        this.selection.height + 1
      );

      setInteractionState({
        ...interactionState,
        boxCells: true,
      });

      return true;
    }
    return false;
  }

  private reset(): void {
    if (this.active) {
      this.state = undefined;
      this.endCell = undefined;
      this.boxCells = undefined;
      this.selection = undefined;
      this.screenSelection = undefined;
      this.active = false;
      this.app.boxCells.reset();

      const { setInteractionState, interactionState } = this.app.settings;
      if (!setInteractionState) throw new Error('Expected setInteractionState to be defined in PointerAutoComplete');

      setInteractionState({
        ...interactionState,
        boxCells: false,
      });
    }
  }

  pointerMove(world: Point): boolean {
    if (IS_READONLY_MODE) return false;
    const { interactionState, setInteractionState } = this.app.settings;
    if (interactionState.panMode !== PanMode.Disabled) return false;
    if (!this.active) {
      if (intersects.rectanglePoint(this.app.cursor.indicator, world)) {
        this.cursor = 'crosshair';
      } else {
        this.cursor = undefined;
      }
      return false;
    } else {
      this.cursor = 'crosshair';
      if (!setInteractionState) throw new Error('Expected setInteractionState to be defined in PointerAutoComplete');

      // handle dragging from the corner
      if (intersects.rectanglePoint(this.app.cursor.indicator, world)) {
      } else if (this.active) {
        const { column, row } = this.app.sheet.gridOffsets.getRowColumnFromWorld(world.x, world.y);
        let boxCells: Rectangle | undefined;
        const { selection, screenSelection } = this;
        if (!selection || !screenSelection) {
          throw new Error('Expected selection and screenSelection to be defined');
        }
        const insideVertical = column >= selection.left && column <= selection.right;
        const insideHorizontal = row >= selection.top && row <= selection.bottom;
        let outsideVertical = false,
          outsideHorizontal = false;
        if (!insideVertical && !insideHorizontal) {
          const aboveVertical = Math.abs(world.y - screenSelection.top);
          const belowVertical = Math.abs(world.y - screenSelection.bottom);
          const vertical = Math.min(aboveVertical, belowVertical);
          const leftHorizontal = Math.abs(world.x - screenSelection.left);
          const rightHorizontal = Math.abs(world.x - screenSelection.right);
          const horizontal = Math.min(leftHorizontal, rightHorizontal);
          if (vertical > horizontal) {
            outsideVertical = true;
          } else {
            outsideHorizontal = true;
          }
        }

        // handle reducing the selection
        if (insideVertical && insideHorizontal) {
          const distanceFromLeft = Math.abs(world.x - screenSelection.left);
          const distanceFromTop = Math.abs(world.y - screenSelection.top);
          if (selection.width > 1 && (selection.height === 0 || distanceFromLeft < distanceFromTop)) {
            this.state = 'shrinkHorizontal';
            boxCells = new Rectangle(selection.x, selection.y, column - selection.left + 1, selection.height + 1);
          } else {
            this.state = 'shrinkVertical';
            boxCells = new Rectangle(selection.x, selection.y, selection.width + 1, row - selection.top + 1);
          }
          this.endCell = { x: column + 1, y: row };
        } else if ((insideVertical && !insideHorizontal) || outsideVertical) {
          if (row > selection.bottom) {
            this.state = 'expandDown';
            boxCells = new Rectangle(selection.x, selection.y, selection.width + 1, row - selection.y + 1);
            this.boxCells = boxCells;
          } else if (row < selection.top) {
            this.state = 'expandUp';
            boxCells = new Rectangle(selection.x, row, selection.width + 1, selection.bottom - row + 1);
            this.boxCells = boxCells;
          }
        } else if (insideHorizontal || outsideHorizontal) {
          if (column > selection.right) {
            this.state = 'expandRight';
            boxCells = new Rectangle(selection.x, selection.y, column - selection.x + 1, selection.height + 1);
            this.boxCells = boxCells;
          } else if (column < selection.left) {
            this.state = 'expandLeft';
            boxCells = new Rectangle(column, selection.y, selection.x - column + 1, selection.height + 1);
            this.boxCells = boxCells;
          }
        }

        if (boxCells && this.state) {
          // Determine whether to show the drag as being a delete action
          let isDelete = false;
          if (this.state.includes('shrink') && this.selection && this.endCell) {
            // Vertical delete
            if (this.selection.height > 0 && this.endCell.y < this.selection.y + this.selection.height) {
              isDelete = true;
            }
            // Horizontal delete
            if (this.selection.width > 0 && this.endCell.x <= this.selection.x + this.selection.width) {
              isDelete = true;
            }
          }
          this.app.boxCells.populate(boxCells, isDelete);
        }
        return true;
      }
      return false;
    }
  }

  private async apply(): Promise<void> {
    if (!this.selection) return;
    if (this.state === 'shrinkHorizontal') {
      if (!this.endCell) return;
      shrinkHorizontal({ app: this.app, selection: this.selection, endCell: this.endCell });
    } else if (this.state === 'shrinkVertical') {
      if (!this.endCell) return;
      shrinkVertical({ app: this.app, selection: this.selection, endCell: this.endCell });
    } else if (this.boxCells) {
      if (this.state === 'expandDown') {
        expandDown({ app: this.app, selection: this.selection, boxCells: this.boxCells });
      } else if (this.state === 'expandRight') {
        expandRight({ app: this.app, selection: this.selection, boxCells: this.boxCells });
      } else if (this.state === 'expandUp') {
        expandUp({ app: this.app, selection: this.selection, boxCells: this.boxCells });
      } else if (this.state === 'expandLeft') {
        expandLeft({ app: this.app, selection: this.selection, boxCells: this.boxCells });
      }
    }
  }

  pointerUp(): boolean {
    if (this.active) {
      this.apply();
      this.reset();
      return true;
    }
    return false;
  }

  handleEscape(): boolean {
    if (this.active) {
      this.reset();
      return true;
    }
    return false;
  }
}
