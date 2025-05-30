import { Plugin } from 'pixi-viewport';

import type { Viewport } from 'pixi-viewport';
import type { FederatedPointerEvent } from 'pixi.js';

/** Insets for mouse edges scrolling regions */
export interface IMouseEdgesInsets {
  /** Distance from center of screen in screen pixels */
  radius?: number | null;

  /** Distance from all sides in screen pixels */
  distance?: number | null;

  /** Alternatively, set top distance (leave unset for no top scroll) */
  top?: number | null;

  /** Alternatively, set bottom distance (leave unset for no top scroll) */
  bottom?: number | null;

  /** Alternatively, set left distance (leave unset for no top scroll) */
  left?: number | null;

  /** Alternatively, set right distance (leave unset for no top scroll) */
  right?: number | null;
}

/** Options for {@link MouseEdges}. */
export interface IMouseEdgesOptions extends IMouseEdgesInsets {
  /** Speed in pixels/frame to scroll viewport */
  speed?: number;

  /** Reverse direction of scroll */
  reverse?: boolean;

  /** Don't use decelerate plugin even if it's installed */
  noDecelerate?: boolean;

  /**
   * If using radius, use linear movement (+/- 1, +/- 1) instead of angled movement.
   *
   * (Math.cos(angle from center), Math.sin(angle from center))
   */
  linear?: boolean;

  /** Allows plugin to continue working even when there's a `mousedown` event. */
  allowButtons?: boolean;
}

const MOUSE_EDGES_OPTIONS: Required<IMouseEdgesOptions> = {
  radius: null,
  distance: null,
  top: null,
  bottom: null,
  left: null,
  right: null,
  speed: 8,
  reverse: false,
  noDecelerate: false,
  linear: false,
  allowButtons: false,
};

/**
 * Scroll viewport when mouse hovers near one of the edges.
 *
 * @event mouse-edge-start(Viewport) emitted when mouse-edge starts
 * @event mouse-edge-end(Viewport) emitted when mouse-edge ends
 */
export class MouseEdges extends Plugin {
  /** Options used to initialize this plugin, cannot be modified later. */
  public readonly options: Readonly<Required<IMouseEdgesOptions>>;

  /** Factor from reverse option. */
  protected readonly reverse: -1 | 1;

  /** Radius squared */
  protected readonly radiusSquared: number | null;

  /** Scroll region size on the left side. */
  protected left!: number | null;

  /** Scroll region size on the top size. */
  protected top!: number | null;

  /** Scroll region size on the right side. */
  protected right!: number | null;

  /** Scroll region size on the bottom side. */
  protected bottom!: number | null;

  protected horizontal?: number | null;

  protected vertical?: number | null;

  /**
   * This is called by {@link Viewport.mouseEdges}.
   */
  constructor(parent: Viewport, options: IMouseEdgesOptions = {}) {
    super(parent);

    this.options = Object.assign({}, MOUSE_EDGES_OPTIONS, options);
    this.reverse = this.options.reverse ? 1 : -1;
    this.radiusSquared = typeof this.options.radius === 'number' ? Math.pow(this.options.radius, 2) : null;

    this.resize();
  }

  public resize(): void {
    const distance = this.options.distance;

    if (distance !== null) {
      this.left = distance;
      this.top = distance;
      this.right = this.parent.screenWidth - distance;
      this.bottom = this.parent.screenHeight - distance;
    } else if (!this.options.radius) {
      this.left = this.options.left;
      this.top = this.options.top;
      this.right = this.options.right === null ? null : this.parent.screenWidth - this.options.right;
      this.bottom = this.options.bottom === null ? null : this.parent.screenHeight - this.options.bottom;
    }
  }

  public down(): boolean {
    if (this.paused) {
      return false;
    }
    if (!this.options.allowButtons) {
      this.horizontal = this.vertical = null;
    }

    return false;
  }

  public move(event: FederatedPointerEvent): boolean {
    if (this.paused) {
      return false;
    }
    if (
      (event.pointerType !== 'mouse' && event.pointerId !== 1) ||
      (!this.options.allowButtons && event.buttons !== 0)
    ) {
      return false;
    }

    const x = event.global.x;
    const y = event.global.y;

    if (this.radiusSquared) {
      const center = this.parent.toScreen(this.parent.center);
      const distance = Math.pow(center.x - x, 2) + Math.pow(center.y - y, 2);

      if (distance >= this.radiusSquared) {
        const angle = Math.atan2(center.y - y, center.x - x);

        if (this.options.linear) {
          this.horizontal = Math.round(Math.cos(angle)) * this.options.speed * this.reverse * (60 / 1000);
          this.vertical = Math.round(Math.sin(angle)) * this.options.speed * this.reverse * (60 / 1000);
        } else {
          this.horizontal = Math.cos(angle) * this.options.speed * this.reverse * (60 / 1000);
          this.vertical = Math.sin(angle) * this.options.speed * this.reverse * (60 / 1000);
        }
      } else {
        if (this.horizontal) {
          this.decelerateHorizontal();
        }
        if (this.vertical) {
          this.decelerateVertical();
        }

        this.horizontal = this.vertical = 0;
      }
    } else {
      if (this.left !== null && x < this.left) {
        this.horizontal = Number(this.reverse) * this.options.speed * (60 / 1000);
      } else if (this.right !== null && x > this.right) {
        this.horizontal = -1 * this.reverse * this.options.speed * (60 / 1000);
      } else {
        this.decelerateHorizontal();
        this.horizontal = 0;
      }
      if (this.top !== null && y < this.top) {
        this.vertical = Number(this.reverse) * this.options.speed * (60 / 1000);
      } else if (this.bottom !== null && y > this.bottom) {
        this.vertical = -1 * this.reverse * this.options.speed * (60 / 1000);
      } else {
        this.decelerateVertical();
        this.vertical = 0;
      }
    }

    return false;
  }

  private decelerateHorizontal(): void {
    const decelerate = this.parent.plugins.get('decelerate', true);

    if (this.horizontal && decelerate && !this.options.noDecelerate) {
      decelerate.activate({ x: (this.horizontal * this.options.speed * this.reverse) / (1000 / 60) });
    }
  }

  private decelerateVertical(): void {
    const decelerate = this.parent.plugins.get('decelerate', true);

    if (this.vertical && decelerate && !this.options.noDecelerate) {
      decelerate.activate({ y: (this.vertical * this.options.speed * this.reverse) / (1000 / 60) });
    }
  }

  public up(): boolean {
    if (this.paused) {
      return false;
    }
    if (this.horizontal) {
      this.decelerateHorizontal();
    }
    if (this.vertical) {
      this.decelerateVertical();
    }
    this.horizontal = this.vertical = null;

    return false;
  }

  public update(): void {
    if (this.paused) {
      return;
    }

    if (this.horizontal || this.vertical) {
      const center = this.parent.center;

      if (this.horizontal) {
        center.x += this.horizontal * this.options.speed;
      }
      if (this.vertical) {
        center.y += this.vertical * this.options.speed;
      }

      this.parent.moveCenter(center);
      this.parent.emit('moved', { viewport: this.parent, type: 'mouse-edges' });
      this.parent.emit('mouse-edge-move', { viewport: this.parent, type: 'mouse-edges' });
    }
  }
}
