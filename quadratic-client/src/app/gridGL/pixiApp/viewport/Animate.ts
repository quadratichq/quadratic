import type { Viewport } from 'pixi-viewport';
import { Plugin } from 'pixi-viewport';
import type { IPointData } from 'pixi.js';
import { Point } from 'pixi.js';
import ease from './ease';

/** Options for {@link Animate}. */
export interface IAnimateOptions {
  /** Time to animate */
  time?: number;

  /** Position to move the viewport to */
  position?: IPointData;

  /**
   * Desired viewport width in world pixels
   *
   * (use instead of scale; aspect ratio is maintained if height is not provided)
   */
  width?: number;

  /**
   * Desired viewport height in world pixels
   *
   * (use instead of scale; aspect ratio is maintained if width is not provided)
   */
  height?: number;

  /** Scale to change zoom (scale.x = scale.y) */
  scale?: number;

  /** Independently change zoom in x-direction */
  scaleX?: number;

  /** Independently change zoom in y-direction */
  scaleY?: number;

  /** Easing function to use */
  ease?: any;

  /** Callback to invoke when the animation completes */
  callbackOnComplete?: (viewport: Viewport) => void;
  callbackBeforeUpdate?: (animate: Animate) => void;

  /** Removes this plugin if interrupted by any user input */
  removeOnInterrupt?: boolean;
}

const DEFAULT_ANIMATE_OPTIONS = {
  removeOnInterrupt: false,
  ease: 'linear',
  time: 1000,
};

/**
 * Animation plugin.
 *
 * @see Viewport#animate
 * @fires animate-end
 */
export class Animate extends Plugin {
  public readonly options: IAnimateOptions & { ease: any; time: number };

  /** The starting x-coordinate of the viewport. */
  startX?: number;

  /** The starting y-coordinate of the viewport. */
  startY?: number;

  /** The change in the x-coordinate of the viewport through the animation.*/
  deltaX?: number;

  /** The change in the y-coordinate of the viewport through the animation. */
  deltaY?: number;

  /** Marks whether the center of the viewport is preserved in the animation. */
  protected keepCenter!: boolean;

  /** The starting viewport width. */
  protected startWidth: number | null = null;

  /** The starting viewport height. */
  protected startHeight: number | null = null;

  /** The change in the viewport's width through the animation. */
  protected deltaWidth: number | null = null;

  /** The change in the viewport's height through the animation. */
  protected deltaHeight: number | null = null;

  /** The viewport's width post-animation. */
  protected width: number | null = null;

  /** The viewport's height post-animation. */
  protected height: number | null = null;

  /** The time since the animation started. */
  protected time = 0;

  /**
   * This is called by {@link Viewport.animate}.
   *
   * @param parent
   * @param options
   */
  constructor(parent: Viewport, options: IAnimateOptions = {}) {
    super(parent);

    this.options = Object.assign({}, DEFAULT_ANIMATE_OPTIONS, options);
    this.options.ease = ease(this.options.ease);

    this.setupPosition();
    this.setupZoom();

    this.time = 0;
  }

  /**
   * Setup `startX`, `startY`, `deltaX`, `deltaY`, `keepCenter`.
   *
   * This is called during construction.
   */
  protected setupPosition(): void {
    if (typeof this.options.position !== 'undefined') {
      this.startX = this.parent.center.x;
      this.startY = this.parent.center.y;
      this.deltaX = this.options.position.x - this.parent.center.x;
      this.deltaY = this.options.position.y - this.parent.center.y;
      this.keepCenter = false;
    } else {
      this.keepCenter = true;
    }
  }

  /**
   * Setup `startWidth, `startHeight`, `deltaWidth, `deltaHeight, `width`, `height`.
   *
   * This is called during construction.
   */
  protected setupZoom(): void {
    this.width = null;
    this.height = null;

    if (typeof this.options.scale !== 'undefined') {
      this.width = this.parent.screenWidth / this.options.scale;
    } else if (typeof this.options.scaleX !== 'undefined' || typeof this.options.scaleY !== 'undefined') {
      if (typeof this.options.scaleX !== 'undefined') {
        // screenSizeInWorldPixels = screenWidth / scale
        this.width = this.parent.screenWidth / this.options.scaleX;
      }
      if (typeof this.options.scaleY !== 'undefined') {
        this.height = this.parent.screenHeight / this.options.scaleY;
      }
    } else {
      if (typeof this.options.width !== 'undefined') {
        this.width = this.options.width;
      }
      if (typeof this.options.height !== 'undefined') {
        this.height = this.options.height;
      }
    }

    if (this.width !== null) {
      this.startWidth = this.parent.screenWidthInWorldPixels;
      this.deltaWidth = this.width - this.startWidth;
    }
    if (this.height !== null) {
      this.startHeight = this.parent.screenHeightInWorldPixels;
      this.deltaHeight = this.height - this.startHeight;
    }
  }

  public down(): boolean {
    if (this.options.removeOnInterrupt) {
      this.parent.plugins.remove('animate');
    }

    return false;
  }

  public complete(): void {
    this.parent.plugins.remove('animate');
    if (this.width !== null) {
      this.parent.fitWidth(this.width, this.keepCenter, this.height === null);
    }
    if (this.height !== null) {
      this.parent.fitHeight(this.height, this.keepCenter, this.width === null);
    }
    if (!this.keepCenter && this.options.position) {
      if (this.options.callbackBeforeUpdate) {
        // move the center so the position is close to its final position
        this.parent.moveCenter(this.options.position);
        this.options.callbackBeforeUpdate(this);
      }
      this.parent.moveCenter(this.options.position);
      console.log('final:', this.options.position);
    }

    this.parent.emit('animate-end', this.parent);

    if (this.options.callbackOnComplete) {
      this.options.callbackOnComplete(this.parent);
    }
  }

  public update(elapsed: number): void {
    if (this.paused) {
      return;
    }
    this.time += elapsed;

    if (this.options.callbackBeforeUpdate) {
      this.options.callbackBeforeUpdate(this);
    }

    const originalZoom = new Point(this.parent.scale.x, this.parent.scale.y);

    if (this.time >= this.options.time) {
      const originalWidth = this.parent.width;
      const originalHeight = this.parent.height;

      this.complete();
      if (originalWidth !== this.parent.width || originalHeight !== this.parent.height) {
        this.parent.emit('zoomed', { viewport: this.parent, original: originalZoom, type: 'animate' });
      }
    } else {
      const percent = this.options.ease(this.time, 0, 1, this.options.time);

      if (this.width !== null) {
        const startWidth = this.startWidth as number;
        const deltaWidth = this.deltaWidth as number;

        this.parent.fitWidth(startWidth + deltaWidth * percent, this.keepCenter, this.height === null);
      }
      if (this.height !== null) {
        const startHeight = this.startHeight as number;
        const deltaHeight = this.deltaHeight as number;

        this.parent.fitHeight(startHeight + deltaHeight * percent, this.keepCenter, this.width === null);
      }
      if (this.width === null) {
        this.parent.scale.x = this.parent.scale.y;
      } else if (this.height === null) {
        this.parent.scale.y = this.parent.scale.x;
      }
      if (!this.keepCenter) {
        const startX = this.startX as number;
        const startY = this.startY as number;
        const deltaX = this.deltaX as number;
        const deltaY = this.deltaY as number;
        const original = new Point(this.parent.x, this.parent.y);

        this.parent.moveCenter(startX + deltaX * percent, startY + deltaY * percent);
        this.parent.emit('moved', { viewport: this.parent, original, type: 'animate' });
      }
      if (this.width || this.height) {
        this.parent.emit('zoomed', { viewport: this.parent, original: originalZoom, type: 'animate' });
      }
    }
  }
}
