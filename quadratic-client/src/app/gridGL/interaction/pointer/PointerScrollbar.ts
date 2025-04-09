import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import type { UIScrollbars } from '@/app/gridGL/UI/UIScrollbars';
import type { FederatedPointerEvent } from 'pixi.js';
import { Point } from 'pixi.js';

export class PointerScrollbar {
  private state: 'hover' | 'horizontal' | 'vertical' | undefined;
  private down: Point | undefined;
  private scrollbarStart: number | undefined;

  get cursor(): string | undefined {
    if (this.state === 'horizontal' || this.state === 'vertical' || this.state === 'hover') {
      return 'auto';
    }
    return undefined;
  }

  /// Gets the UI scrollbars element.
  private get scrollbars(): UIScrollbars {
    return pixiApp.scrollbars;
  }

  /// Returns true if the pointer is down and interacting with the scrollbar.
  isActive(): 'horizontal' | 'vertical' | undefined {
    if (this.state === undefined || this.state === 'hover') {
      return undefined;
    } else {
      return this.state;
    }
  }

  pointerDown(e: FederatedPointerEvent): boolean {
    const overlap = this.scrollbars.contains(e.clientX, e.clientY);
    if (overlap) {
      this.state = overlap;
      pixiApp.viewport.turnOffDecelerate();
      this.down = new Point(e.clientX, e.clientY);
      if (overlap === 'horizontal') {
        this.scrollbarStart = this.scrollbars.horizontalStart;
      } else if (overlap === 'vertical') {
        this.scrollbarStart = this.scrollbars.verticalStart;
      }
      return true;
    }
    return false;
  }

  /// Checks if the pointer is hovering over the scrollbar.
  private checkHover(e: FederatedPointerEvent): boolean {
    const overlap = this.scrollbars.contains(e.clientX, e.clientY);
    if (overlap) {
      this.state = 'hover';
      return true;
    } else if (this.state === 'hover') {
      this.state = undefined;
    }
    return false;
  }

  // Handles pointer moving outside of the scrollbar.
  pointerMoveOutside(x: number, y: number) {
    if (this.state === 'horizontal') {
      if (this.down !== undefined && this.scrollbarStart !== undefined) {
        const delta = x - this.down.x;
        const actualDelta = this.scrollbars.adjustHorizontal(delta);
        this.down.x = actualDelta + this.down.x;
      }
    } else if (this.state === 'vertical') {
      if (this.down !== undefined && this.scrollbarStart !== undefined) {
        const delta = y - this.down.y;
        const actualDelta = this.scrollbars.adjustVertical(delta);
        this.down.y = actualDelta + this.down.y;
      }
    }
  }

  pointerMove(e: FederatedPointerEvent): boolean {
    if (this.state === 'horizontal') {
      if (this.down !== undefined && this.scrollbarStart !== undefined) {
        const delta = e.clientX - this.down.x;
        const actualDelta = this.scrollbars.adjustHorizontal(delta);
        this.down.x = actualDelta + this.down.x;
      }
      return true;
    }
    if (this.state === 'vertical') {
      if (this.down !== undefined && this.scrollbarStart !== undefined) {
        const delta = e.clientY - this.down.y;
        const actualDelta = this.scrollbars.adjustVertical(delta);
        this.down.y = actualDelta + this.down.y;
      }
      return true;
    }
    return this.checkHover(e);
  }

  pointerUp(): boolean {
    if (this.state === 'horizontal' || this.state === 'vertical') {
      this.state = undefined;
      pixiApp.viewport.turnOnDecelerate();
      this.scrollbars.setDirty();
      return true;
    }
    return false;
  }

  handleEscape(): boolean {
    if (this.state === 'horizontal' || this.state === 'vertical') {
      this.state = undefined;
      this.scrollbars.setDirty();
      return true;
    }
    return false;
  }
}
