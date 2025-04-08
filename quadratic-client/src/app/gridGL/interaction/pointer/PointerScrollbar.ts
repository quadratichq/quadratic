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

  pointerMove(e: FederatedPointerEvent): boolean {
    if (this.state === 'horizontal') {
      return true;
    }
    if (this.state === 'vertical') {
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
