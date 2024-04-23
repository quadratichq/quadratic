import { convertColorStringToTint } from '@/helpers/convertColor';
import { colors } from '@/theme/colors';
import { Graphics } from 'pixi.js';
import { SpriteImage } from '../cells/CellsImages';

// These should be consistent with ResizeControl.tsx
export const IMAGE_BORDER_WIDTH = 5;
export const IMAGE_BORDER_OFFSET = 2;
const TRANSITION_DELAY_MS = 200;
const TRANSITION_TIME_MS = 300;

export class UIImageResize extends Graphics {
  private active?: SpriteImage;
  private animationState?: 'delay-enter' | 'delay-exit' | 'enter' | 'exit';
  private animationTime = 0;
  private animationLastTime = 0;

  activate(sprite?: SpriteImage) {
    if (!sprite && this.active) {
      this.active = undefined;
      this.animationState = 'delay-exit';
      this.animationLastTime = Date.now();
      this.animationTime = 0;
    } else if (this.active !== sprite) {
      this.active = sprite;
      this.draw();
      this.animationTime = 0;
      this.animationState = 'delay-enter';
      this.alpha = 0;
      this.animationLastTime = Date.now();
    }
  }

  draw() {
    if (this.active) {
      this.clear();
      const color = convertColorStringToTint(colors.quadraticPrimary);
      this.lineStyle({ color, width: IMAGE_BORDER_WIDTH });

      // vertical line on the right
      this.moveTo(this.active.x + this.active.width + IMAGE_BORDER_OFFSET, this.active.y);
      this.lineTo(this.active.x + this.active.width, this.active.y + this.active.height + IMAGE_BORDER_OFFSET);

      // horizontal line on the bottom
      this.moveTo(this.active.x, this.active.y + this.active.height + IMAGE_BORDER_OFFSET);
      this.lineTo(this.active.x + this.active.width + IMAGE_BORDER_OFFSET, this.active.y + this.active.height);
    }
  }

  private easeInOutSine(time: number, duration: number): number {
    let t = time / duration;
    return 0.5 * (1 - Math.cos(t * Math.PI));
  }

  get dirty(): boolean {
    return !!this.animationState;
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
          this.alpha = 1;
        } else {
          this.alpha = this.easeInOutSine(this.animationTime, TRANSITION_TIME_MS) as number;
        }
      } else if (this.animationState === 'exit') {
        if (this.animationTime > TRANSITION_TIME_MS) {
          this.animationState = undefined;
          this.alpha = 0;
        } else {
          this.alpha = (1 - this.easeInOutSine(this.animationTime, TRANSITION_TIME_MS)) as number;
        }
      }
      return true;
    }
    return false;
  }
}
