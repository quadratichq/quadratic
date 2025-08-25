import { events, type DirtyObject } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import type { CellsImage } from '@/app/gridGL/cells/cellsImages/CellsImage';
import { convertColorStringToTint } from '@/app/helpers/convertColor';
import type { CoreClientImage } from '@/app/web-workers/quadraticCore/coreClientMessages';
import { Container, Graphics } from 'pixi.js';

// These should be consistent with ResizeControl.tsx
export const IMAGE_BORDER_WIDTH = 5;
export const IMAGE_BORDER_OFFSET = 2;
const TRANSITION_DELAY_MS = 200;
const TRANSITION_TIME_MS = 300;

// todo: this should have separate alphas for the right and bottom borders

export class UICellImages extends Container {
  private resizing: Graphics;

  private active?: CellsImage;
  private animationState?: 'delay-enter' | 'delay-exit' | 'enter' | 'exit';
  private animationTime = 0;
  private animationLastTime = 0;

  dirtyResizing = false;

  constructor() {
    super();
    this.resizing = this.addChild(new Graphics());
    events.on('changeSheet', this.changeSheet);
    events.on('updateImage', this.checkImageChange);
    events.on('setDirty', this.setDirtyHandler);
  }

  destroy() {
    events.off('changeSheet', this.changeSheet);
    events.off('updateImage', this.checkImageChange);
    events.off('setDirty', this.setDirtyHandler);
    super.destroy();
  }

  private setDirtyHandler = (dirty: DirtyObject) => {
    if (dirty.cellImages) {
      this.dirtyResizing = true;
    }
  };

  private checkImageChange = (image: CoreClientImage) => {
    if (
      this.active &&
      image.sheetId === sheets.current &&
      image.x === this.active.pos.x &&
      image.y === this.active.pos.y
    ) {
      this.dirtyResizing = true;
    }
  };

  setDirty() {
    this.dirtyResizing = true;
  }

  private changeSheet = () => {
    this.active = undefined;
    this.dirtyResizing = true;
  };

  activate(sprite?: CellsImage) {
    if (!sprite && this.active) {
      this.active = undefined;
      this.animationState = 'delay-exit';
      this.animationLastTime = Date.now();
      this.animationTime = 0;
    } else if (this.active !== sprite) {
      this.active = sprite;
      this.dirtyResizing = true;
      this.animationTime = 0;
      this.animationState = 'delay-enter';
      this.resizing.alpha = 0;
      this.animationLastTime = Date.now();
    }
  }

  private drawResizing(): boolean {
    if (this.dirtyResizing) {
      this.dirtyResizing = false;
      this.resizing.clear();
      if (this.active) {
        const hslColorFromCssVar = window.getComputedStyle(document.documentElement).getPropertyValue('--primary');
        const color = convertColorStringToTint(`hsl(${hslColorFromCssVar})`);
        this.resizing.lineStyle({ color, width: IMAGE_BORDER_WIDTH });

        const table = this.active.table;
        // vertical line on the right
        this.resizing.moveTo(table.tableBounds.right + IMAGE_BORDER_OFFSET, table.tableBounds.top);
        this.resizing.lineTo(
          table.tableBounds.right + IMAGE_BORDER_OFFSET,
          table.tableBounds.bottom + IMAGE_BORDER_OFFSET
        );

        // horizontal line on the bottom
        this.resizing.moveTo(table.tableBounds.left, table.tableBounds.bottom + IMAGE_BORDER_OFFSET);
        this.resizing.lineTo(
          table.tableBounds.right + IMAGE_BORDER_OFFSET,
          table.tableBounds.bottom + IMAGE_BORDER_OFFSET
        );
      }
      return true;
    }
    return false;
  }

  private easeInOutSine(time: number, duration: number): number {
    let t = time / duration;
    return 0.5 * (1 - Math.cos(t * Math.PI));
  }

  get dirty(): boolean {
    return !!this.animationState || this.dirtyResizing;
  }

  update(): boolean {
    if (this.animationState) {
      const now = Date.now();
      this.animationTime += now - this.animationLastTime;
      this.animationLastTime = now;
      if (this.animationState.includes('delay')) {
        if (this.animationTime > TRANSITION_DELAY_MS) {
          this.animationState = this.animationState.replace('delay-', '') as 'enter' | 'exit';
          this.animationTime -= TRANSITION_DELAY_MS;
        }
      }
      if (this.animationState === 'enter') {
        if (this.animationTime > TRANSITION_TIME_MS) {
          this.animationState = undefined;
          this.resizing.alpha = 1;
        } else {
          this.resizing.alpha = this.easeInOutSine(this.animationTime, TRANSITION_TIME_MS) as number;
        }
      } else if (this.animationState === 'exit') {
        if (this.animationTime > TRANSITION_TIME_MS) {
          this.animationState = undefined;
          this.resizing.alpha = 0;
        } else {
          this.resizing.alpha = (1 - this.easeInOutSine(this.animationTime, TRANSITION_TIME_MS)) as number;
        }
      }
      this.drawResizing();
      return true;
    } else {
      if (this.drawResizing()) return true;
      return false;
    }
  }
}
