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
  isActive(): boolean {
    return this.state !== undefined && this.state !== 'hover';
  }

  pointerDown(e: FederatedPointerEvent): boolean {
    const overlap = this.scrollbars.contains(e.clientX, e.clientY);
    if (overlap) {
      this.state = overlap;
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
        this.down.x = x;
        this.scrollbars.adjustHorizontal(delta);
      }
    } else if (this.state === 'vertical') {
      if (this.down !== undefined && this.scrollbarStart !== undefined) {
        const delta = y - this.down.y;
        this.down.y = y;
        this.scrollbars.adjustVertical(delta);
      }
    }
  }

  pointerMove(e: FederatedPointerEvent): boolean {
    if (this.state === 'horizontal') {
      if (this.down !== undefined && this.scrollbarStart !== undefined) {
        const delta = e.clientX - this.down.x;
        this.down.x = e.clientX;
        this.scrollbars.adjustHorizontal(delta);
      }
      return true;
    }
    if (this.state === 'vertical') {
      if (this.down !== undefined && this.scrollbarStart !== undefined) {
        const delta = e.clientY - this.down.y;
        this.down.y = e.clientY;
        this.scrollbars.adjustVertical(delta);
      }
      return true;
    }
    return this.checkHover(e);
  }

  pointerUp(): boolean {
    if (this.state === 'horizontal' || this.state === 'vertical') {
      this.state = undefined;
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
