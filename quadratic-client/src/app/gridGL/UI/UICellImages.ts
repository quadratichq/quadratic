import { events } from '@/app/events/events';
import { convertColorStringToTint } from '@/app/helpers/convertColor';
import { Container, Graphics } from 'pixi.js';
import { CellsImage } from '../cells/cellsImages/CellsImage';

// These should be consistent with ResizeControl.tsx
export const IMAGE_BORDER_WIDTH = 5;
export const IMAGE_BORDER_OFFSET = 2;
const TRANSITION_DELAY_MS = 200;
const TRANSITION_TIME_MS = 300;

export class UICellImages extends Container {
  private borders: Graphics;
  private resizing: Graphics;

  private active?: CellsImage;
  private animationState?: 'delay-enter' | 'delay-exit' | 'enter' | 'exit';
  private animationTime = 0;
  private animationLastTime = 0;

  // dirtyBorders = false;
  dirtyResizing = false;

  constructor() {
    super();
    this.borders = this.addChild(new Graphics());
    this.resizing = this.addChild(new Graphics());
    events.on('changeSheet', this.changeSheet);
  }

  private changeSheet = () => {
    this.active = undefined;
    // this.dirtyBorders = true;
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

  // drawBorders(): boolean {
  //   if (this.dirtyBorders) {
  //     this.dirtyBorders = false;
  //     this.borders.clear();
  //     const images = pixiApp.cellsSheets.current?.getCellsImages();
  //     if (!images) return true;
  //     const hslColorFromCssVar = window.getComputedStyle(document.documentElement).getPropertyValue('--primary');
  //     const color = convertColorStringToTint(`hsl(${hslColorFromCssVar})`);
  //     this.borders.lineStyle({ color, width: 1 });
  //     images.forEach((image) => {
  //       this.borders.drawRect(image.x, image.y, image.width, image.height);
  //     });
  //     return true;
  //   }
  //   return false;
  // }

  drawResizing(): boolean {
    if (this.dirtyResizing) {
      this.dirtyResizing = false;
      this.resizing.clear();
      if (this.active) {
        const hslColorFromCssVar = window.getComputedStyle(document.documentElement).getPropertyValue('--primary');
        const color = convertColorStringToTint(`hsl(${hslColorFromCssVar})`);
        this.resizing.lineStyle({ color, width: IMAGE_BORDER_WIDTH });

        // vertical line on the right
        this.resizing.moveTo(this.active.x + this.active.width + IMAGE_BORDER_OFFSET, this.active.y);
        this.resizing.lineTo(
          this.active.x + this.active.width,
          this.active.y + this.active.height + IMAGE_BORDER_OFFSET
        );

        // horizontal line on the bottom
        this.resizing.moveTo(this.active.x, this.active.y + this.active.height + IMAGE_BORDER_OFFSET);
        this.resizing.lineTo(
          this.active.x + this.active.width + IMAGE_BORDER_OFFSET,
          this.active.y + this.active.height
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
    return !!this.animationState || /*this.dirtyBorders ||*/ this.dirtyResizing;
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
      // this.drawBorders();
      this.drawResizing();
      return true;
    } else {
      // let rendered = this.drawBorders();
      if (this.drawResizing()) return true;
      // return rendered;
      return false;
    }
  }
}
