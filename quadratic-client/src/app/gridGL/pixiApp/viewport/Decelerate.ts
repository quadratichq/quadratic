import { Plugin, Viewport } from 'pixi-viewport';

export const DECELERATE_OUT_OF_BOUNDS_FACTOR = 0.8;
const MIN_SPEED = 0.1;

export interface IDecelerateOptions {
  /**
   * Percent to decelerate after movement. This should be between 0 and 1, exclusive.
   *
   * @default 0.95
   */
  friction?: number;

  /**
   * Percent to decelerate when past boundaries (only applicable when viewport.bounce() is active)
   *
   * @default 0.8
   */
  bounce?: number;

  /**
   * Minimum velocity before stopping/reversing acceleration
   *
   * @default 0.01
   */
  minSpeed?: number;
}

/** Viewport position snapshot that's saved by {@link DeceleratePlugin} to estimate panning velocity. */
export interface IDecelerateSnapshot {
  /** x-coordinate of the viewport. */
  x: number;

  /** y-coordinate of the viewport. */
  y: number;

  /** Time at which this snapshot was taken. */
  time: number;
}

const DEFAULT_DECELERATE_OPTIONS: Required<IDecelerateOptions> = {
  friction: 0.98,
  bounce: 0.8,
  minSpeed: MIN_SPEED,
};

/**
 * Time period of decay (1 frame)
 *
 * @internal
 * @ignore
 */
const TP = 16;

/**
 * Plugin to decelerate viewport velocity smoothly after panning ends.
 *
 * @public
 */
export class Decelerate extends Plugin {
  /** Options used to initialize this plugin. */
  public readonly options: Required<IDecelerateOptions>;

  /**
   * x-component of the velocity of viewport provided by this plugin, at the current time.
   *
   * This is measured in px/frame, where a frame is normalized to 16 milliseconds.
   */
  public x!: number | null;

  /**
   * y-component of the velocity of the viewport provided by this plugin, at the current time.
   *
   * This is measured in px/frame, where a frame is normalized to 16 milliseconds.
   */
  public y!: number | null;

  /**
   * The decay factor for the x-component of the viewport.
   *
   * The viewport's velocity decreased by this amount each 16 milliseconds.
   */
  public percentChangeX!: number;

  /**
   * The decay factor for the y-component of the viewport.
   *
   * The viewport's velocity decreased by this amount each 16 milliseconds.
   */
  public percentChangeY!: number;

  /** Saved list of recent viewport position snapshots, to estimate velocity. */
  protected saved: Array<IDecelerateSnapshot>;

  /** The time since the user released panning of the viewport. */
  protected timeSinceRelease: number;

  /**
   * This is called by {@link Viewport.decelerate}.
   */
  constructor(parent: Viewport, options: IDecelerateOptions = {}) {
    super(parent);

    this.options = Object.assign({}, DEFAULT_DECELERATE_OPTIONS, options);
    this.saved = [];
    this.timeSinceRelease = 0;

    this.reset();
    this.parent.on('moved', (data) => this.handleMoved(data));
  }

  public down(): boolean {
    this.saved = [];
    this.x = this.y = null;

    return false;
  }

  public isActive(): boolean {
    return !!(this.x || this.y);
  }

  public move(): boolean {
    if (this.paused) {
      return false;
    }

    const count = this.parent.input.count();

    if (count === 1 || (count > 1 && !this.parent.plugins.get('pinch', true))) {
      this.saved.push({ x: this.parent.x, y: this.parent.y, time: performance.now() });

      if (this.saved.length > 60) {
        this.saved.splice(0, 30);
      }
    }

    // Silently recording viewport positions
    return false;
  }

  /** Listener to viewport's "moved" event. */
  protected handleMoved(e: any): void {
    if (this.saved.length) {
      const last = this.saved[this.saved.length - 1];

      if (e.type === 'clamp-x' && e.original) {
        if (last.x === e.original.x) {
          last.x = this.parent.x;
        }
      } else if (e.type === 'clamp-y' && e.original) {
        if (last.y === e.original.y) {
          last.y = this.parent.y;
        }
      }
    }
  }

  public up(): boolean {
    if (this.parent.input.count() === 0 && this.saved.length) {
      const now = performance.now();

      for (const save of this.saved) {
        if (save.time >= now - 100) {
          const time = now - save.time;

          this.x = (this.parent.x - save.x) / time;
          this.y = (this.parent.y - save.y) / time;
          this.percentChangeX = this.percentChangeY = this.options.friction;
          this.timeSinceRelease = 0;
          break;
        }
      }
    }

    return false;
  }

  /**
   * Manually activate deceleration, starting from the (x, y) velocity components passed in the options.
   *
   * @param {object} options
   * @param {number} [options.x] - Specify x-component of initial velocity.
   * @param {number} [options.y] - Specify y-component of initial velocity.
   */
  public activate(options: { x?: number; y?: number }): void {
    options = options || {};

    if (typeof options.x !== 'undefined') {
      this.x = options.x;
      this.percentChangeX = this.options.friction;
    }
    if (typeof options.y !== 'undefined') {
      this.y = options.y;
      this.percentChangeY = this.options.friction;
    }
  }

  public update(elapsed: number): void {
    if (this.paused) {
      return;
    }

    /*
     * See https://github.com/davidfig/pixi-viewport/issues/271 for math.
     *
     * The viewport velocity (this.x, this.y) decays exponentially by the the decay factor
     * (this.percentChangeX, this.percentChangeY) each frame. This velocity function is integrated
     * to calculate the displacement.
     */

    const moved = this.x || this.y;

    const ti = this.timeSinceRelease;
    const tf = this.timeSinceRelease + elapsed;

    if (this.x) {
      // add additional percent change if we're in the negative direction
      let percentChangeX = this.percentChangeX;
      if (this.parent.x > 0) {
        percentChangeX = DECELERATE_OUT_OF_BOUNDS_FACTOR;
        console.log('here');
      }

      const k = this.percentChangeX;
      const lnk = Math.log(k);

      // Apply velocity delta on the viewport x-coordinate.
      this.parent.x += ((this.x * TP) / lnk) * (Math.pow(k, tf / TP) - Math.pow(k, ti / TP));

      // Apply decay on x-component of velocity
      this.x *= Math.pow(percentChangeX, elapsed / TP);
    }
    if (this.y) {
      // add additional percent change if we're in the negative direction
      let percentChangeY = this.percentChangeY;
      if (this.parent.y > 0) {
        percentChangeY = DECELERATE_OUT_OF_BOUNDS_FACTOR;
      }

      const k = percentChangeY;
      const lnk = Math.log(k);

      // Apply velocity delta on the viewport y-coordinate.
      this.parent.y += ((this.y * TP) / lnk) * (Math.pow(k, tf / TP) - Math.pow(k, ti / TP));

      // Apply decay on y-component of velocity
      this.y *= Math.pow(percentChangeY, elapsed / TP);
    }

    this.timeSinceRelease += elapsed;

    // End decelerate velocity once it goes under a certain amount of precision.
    if (this.x && this.y) {
      if (Math.abs(this.x) < this.options.minSpeed && Math.abs(this.y) < this.options.minSpeed) {
        this.x = 0;
        this.y = 0;
      }
    } else {
      if (Math.abs(this.x || 0) < this.options.minSpeed) {
        this.x = 0;
      }
      if (Math.abs(this.y || 0) < this.options.minSpeed) {
        this.y = 0;
      }
    }

    if (moved) {
      this.parent.emit('moved', { viewport: this.parent, type: 'decelerate' });
    }
  }

  public reset(): void {
    this.x = this.y = null;
  }
}
