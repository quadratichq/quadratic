/* eslint-disable @typescript-eslint/no-unused-vars */
import { Point, Rectangle } from 'pixi.js';
import { IS_READONLY_MODE } from '../../../constants/app';
import { PixiApp } from '../../pixiApp/PixiApp';
import { Sheet } from '../../../grid/sheet/Sheet';
import { PanMode } from '../../../atoms/gridInteractionStateAtom';
import { intersects } from '../../helpers/intersects';

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
  private screenSelection?: Rectangle;
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
        this.selection.right,
        this.selection.width + 1,
        this.selection.height + 1
      );
      this.app.debug.clear().lineStyle({ color: 0xff0000, width: 1 }).drawShape(this.screenSelection);

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
    if (this.active) {
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
          console.log('outsideVertical', horizontal, vertical);
        } else {
          outsideHorizontal = true;
          console.log('outsideHorizontal', horizontal, vertical);
        }
      }

      if ((insideVertical && !insideHorizontal) || outsideVertical) {
        if (row > selection.bottom) {
          this.state = 'expandDown';
          boxCells = new Rectangle(selection.x, selection.y, selection.width + 1, row - selection.y + 1);
        } else if (row < selection.top) {
          this.state = 'expandUp';
          boxCells = new Rectangle(selection.x, row, selection.width + 1, selection.bottom - row + 1);
        } else {
          this.state = 'shrinkVertical';
          boxCells = new Rectangle(selection.x, selection.y, selection.width + 1, row - selection.top + 1);
        }
      } else if (insideHorizontal || outsideHorizontal) {
        if (column > selection.right) {
          this.state = 'expandRight';
          boxCells = new Rectangle(selection.x, selection.y, column - selection.x + 1, selection.height + 1);
        } else if (column < selection.left) {
          this.state = 'expandLeft';
          boxCells = new Rectangle(column, selection.y, selection.x - column + 1, selection.height + 1);
        } else {
          this.state = 'shrinkHorizontal';
          boxCells = new Rectangle(selection.x, selection.y, column - selection.left + 1, selection.height + 1);
        }
      }

      if (boxCells) {
        this.app.boxCells.populate(boxCells);
      }
      return true;
    }
    return false;
  }

  pointerUp(): boolean {
    if (this.active) {
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
