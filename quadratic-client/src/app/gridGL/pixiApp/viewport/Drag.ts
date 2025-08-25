//! Cloned from pixi-viewport Drag plugin to add clamping only for changes when
//! dragging (zoom has different clamping).

import { SCALE_OUT_OF_BOUNDS_SCROLL } from '@/app/gridGL/pixiApp/viewport/Wheel';
import type { JsCoordinate } from '@/app/quadratic-core-types';
import type { Decelerate, Viewport } from 'pixi-viewport';
import { Plugin } from 'pixi-viewport';
import { Point, type FederatedPointerEvent } from 'pixi.js';

/** Options for {@link Drag}. */
export interface IDragOptions {
  /**
   * direction to drag
   *
   * @default "all"
   */
  direction?: string;

  /**
   * whether click to drag is active
   *
   * @default true
   */
  pressDrag?: boolean;

  /**
   * Use wheel to scroll in direction (unless wheel plugin is active)
   *
   * @default true
   */
  wheel?: boolean;

  /**
   * number of pixels to scroll with each wheel spin
   *
   * @default 1
   */
  wheelScroll?: number;

  /**
   * reverse the direction of the wheel scroll
   *
   * @default false
   */
  reverse?: boolean;

  /**
   * clamp wheel(to avoid weird bounce with mouse wheel). Can be 'x' or 'y' or `true`.
   *
   * @default false
   */
  clampWheel?: boolean | string;

  /**
   * where to place world if too small for screen
   *
   * @default "center"
   */
  underflow?: string;

  /**
   * factor to multiply drag to increase the speed of movement
   *
   * @default 1
   */
  factor?: number;

  /**
   * Changes which mouse buttons trigger drag.
   *
   * Use: 'all', 'left', right' 'middle', or some combination, like, 'middle-right'; you may want to set
   * `viewport.options.disableOnContextMenu` if you want to use right-click dragging.
   *
   * @default "all"
   */
  mouseButtons?: 'all' | string;

  /**
   * Array containing {@link key|https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/code} codes of
   * keys that can be pressed for the drag to be triggered, e.g.: ['ShiftLeft', 'ShiftRight'}.
   *
   * @default null
   */
  keyToPress?: string[] | null;

  /**
   * Ignore keyToPress for touch events.
   *
   * @default false
   */
  ignoreKeyToPressOnTouch?: boolean;

  /**
   * Scaling factor for non-DOM_DELTA_PIXEL scrolling events.
   *
   * @default 20
   */
  lineHeight?: number;

  /**
   * Swap x and y axes when scrolling.
   *
   * @default false
   */
  wheelSwapAxes?: boolean;
}

const DEFAULT_DRAG_OPTIONS: Required<IDragOptions> = {
  direction: 'all',
  pressDrag: true,
  wheel: true,
  wheelScroll: 1,
  reverse: false,
  clampWheel: false,
  underflow: 'center',
  factor: 1,
  mouseButtons: 'all',
  keyToPress: null,
  ignoreKeyToPressOnTouch: false,
  lineHeight: 20,
  wheelSwapAxes: false,
};

/**
 * Plugin to enable panning/dragging of the viewport to move around.
 *
 * @public
 */
export class Drag extends Plugin {
  /** Options used to initialize this plugin, cannot be modified later. */
  public readonly options: Readonly<Required<IDragOptions>>;

  /** Flags when viewport is moving. */
  protected moved: boolean;

  /** Factor to apply from {@link IDecelerateOptions}'s reverse. */
  protected reverse: 1 | -1;

  /** Holds whether dragging is enabled along the x-axis. */
  protected xDirection: boolean;

  /** Holds whether dragging is enabled along the y-axis. */
  protected yDirection: boolean;

  /** Flags whether the keys required to drag are pressed currently. */
  protected keyIsPressed: boolean;

  /** Holds whether the left, center, and right buttons are required to pan. */
  protected mouse!: [boolean, boolean, boolean];

  /** Underflow factor along x-axis */
  protected underflowX!: -1 | 0 | 1;

  /** Underflow factor along y-axis */
  protected underflowY!: -1 | 0 | 1;

  /** Last pointer position while panning. */
  protected last?: JsCoordinate | null;

  /** The ID of the pointer currently panning the viewport. */
  protected current?: number;

  /** Array of event-handlers for window */
  private windowEventHandlers: Array<{ event: string; handler: (e: any) => void }> = [];

  /**
   * This is called by {@link Viewport.drag}.
   */
  constructor(parent: Viewport, options = {}) {
    super(parent);

    this.options = Object.assign({}, DEFAULT_DRAG_OPTIONS, options);
    this.moved = false;
    this.reverse = this.options.reverse ? 1 : -1;
    this.xDirection = !this.options.direction || this.options.direction === 'all' || this.options.direction === 'x';
    this.yDirection = !this.options.direction || this.options.direction === 'all' || this.options.direction === 'y';
    this.keyIsPressed = false;

    this.parseUnderflow();
    this.mouseButtons(this.options.mouseButtons);

    if (this.options.keyToPress) {
      this.handleKeyPresses(this.options.keyToPress);
    }
  }

  /**
   * Handles keypress events and set the keyIsPressed boolean accordingly
   *
   * @param {array} codes - key codes that can be used to trigger drag event
   */
  protected handleKeyPresses(codes: string[]): void {
    const keydownHandler = (e: KeyboardEvent) => {
      if (codes.includes(e.code)) {
        this.keyIsPressed = true;
      }
    };

    const keyupHandler = (e: KeyboardEvent) => {
      if (codes.includes(e.code)) {
        this.keyIsPressed = false;
      }
    };

    this.addWindowEventHandler('keyup', keyupHandler);
    this.addWindowEventHandler('keydown', keydownHandler);
  }

  private addWindowEventHandler(event: string, handler: (e: any) => void): void {
    if (typeof window === 'undefined') return;
    window.addEventListener(event, handler);
    this.windowEventHandlers.push({ event, handler });
  }

  public override destroy(): void {
    if (typeof window === 'undefined') return;
    this.windowEventHandlers.forEach(({ event, handler }) => {
      window.removeEventListener(event, handler);
    });
  }

  /**
   * initialize mousebuttons array
   * @param {string} buttons
   */
  protected mouseButtons(buttons: string): void {
    if (!buttons || buttons === 'all') {
      this.mouse = [true, true, true];
    } else {
      this.mouse = [buttons.indexOf('left') !== -1, buttons.indexOf('middle') !== -1, buttons.indexOf('right') !== -1];
    }
  }

  protected parseUnderflow(): void {
    const clamp = this.options.underflow.toLowerCase();

    if (clamp === 'center') {
      this.underflowX = 0;
      this.underflowY = 0;
    } else {
      if (clamp.includes('left')) {
        this.underflowX = -1;
      } else if (clamp.includes('right')) {
        this.underflowX = 1;
      } else {
        this.underflowX = 0;
      }
      if (clamp.includes('top')) {
        this.underflowY = -1;
      } else if (clamp.includes('bottom')) {
        this.underflowY = 1;
      } else {
        this.underflowY = 0;
      }
    }
  }

  /**
   * @param {PIXI.FederatedPointerEvent} event
   * @returns {boolean}
   */
  protected checkButtons(event: FederatedPointerEvent): boolean {
    const isMouse = event.data.pointerType === 'mouse';
    const count = this.parent.input.count();

    if (count === 1 || (count > 1 && !this.parent.plugins.get('pinch', true))) {
      if (!isMouse || this.mouse[event.data.button]) {
        return true;
      }
    }

    return false;
  }

  /**
   * @param {PIXI.FederatedPointerEvent} event
   * @returns {boolean}
   */
  protected checkKeyPress(event: FederatedPointerEvent): boolean {
    return (
      !this.options.keyToPress ||
      this.keyIsPressed ||
      (this.options.ignoreKeyToPressOnTouch && event.data.pointerType === 'touch')
    );
  }

  public down(event: FederatedPointerEvent): boolean {
    if (this.paused || !this.options.pressDrag) {
      return false;
    }
    if (this.checkButtons(event) && this.checkKeyPress(event)) {
      this.last = { x: event.global.x, y: event.global.y };
      this.current = event.pointerId;

      return true;
    }
    this.last = null;

    return false;
  }

  get active(): boolean {
    return this.moved;
  }

  public move(event: FederatedPointerEvent): boolean {
    if (this.paused || !this.options.pressDrag) {
      return false;
    }
    if (this.last && this.current === event.pointerId) {
      const x = event.global.x;
      const y = event.global.y;
      const count = this.parent.input.count();

      if (count === 1 || (count > 1 && !this.parent.plugins.get('pinch', true))) {
        const distX = x - this.last.x;
        const distY = y - this.last.y;

        if (
          this.moved ||
          (this.xDirection && this.parent.input.checkThreshold(distX)) ||
          (this.yDirection && this.parent.input.checkThreshold(distY))
        ) {
          const newPoint = { x, y };
          const deltaX = newPoint.x - this.last.x;
          this.parent.x += deltaX * (deltaX > 1 && this.parent.x > 0 ? SCALE_OUT_OF_BOUNDS_SCROLL : 1);
          const deltaY = newPoint.y - this.last.y;
          this.parent.y += deltaY * (deltaY > 1 && this.parent.y > 0 ? SCALE_OUT_OF_BOUNDS_SCROLL : 1);
          this.last = newPoint;
          if (!this.moved) {
            this.parent.emit('drag-start', {
              event,
              screen: new Point(this.last.x, this.last.y),
              world: this.parent.toWorld(new Point(this.last.x, this.last.y)),
              viewport: this.parent,
            });
          }
          this.moved = true;
          this.parent.emit('moved', { viewport: this.parent, type: 'drag' });

          return true;
        }
      } else {
        this.moved = false;
      }
    }

    return false;
  }

  public up(event: FederatedPointerEvent): boolean {
    if (this.paused) {
      return false;
    }

    const touches = this.parent.input.touches;

    if (touches.length === 1) {
      const pointer = touches[0];

      if (pointer.last) {
        this.last = { x: pointer.last.x, y: pointer.last.y };
        this.current = pointer.id;
      }
      this.moved = false;

      return true;
    } else if (this.last) {
      if (this.moved) {
        const screen = new Point(this.last.x, this.last.y);

        this.parent.emit('drag-end', {
          event,
          screen,
          world: this.parent.toWorld(screen),
          viewport: this.parent,
        });
        this.last = null;
        this.moved = false;

        return true;
      }
    }

    return false;
  }

  public wheel(event: WheelEvent): boolean {
    if (this.paused) {
      return false;
    }

    if (this.options.wheel) {
      const wheel = this.parent.plugins.get('wheel', true);

      if (!wheel || (!wheel.options.wheelZoom && !event.ctrlKey)) {
        const step = event.deltaMode ? this.options.lineHeight : 1;

        const deltas = [event.deltaX, event.deltaY];
        const [deltaX, deltaY] = this.options.wheelSwapAxes ? deltas.reverse() : deltas;

        if (this.xDirection) {
          this.parent.x += deltaX * step * this.options.wheelScroll * this.reverse;
        }
        if (this.yDirection) {
          this.parent.y += deltaY * step * this.options.wheelScroll * this.reverse;
        }
        if (this.options.clampWheel) {
          this.clamp();
        }
        this.parent.emit('wheel-scroll', this.parent);
        this.parent.emit('moved', { viewport: this.parent, type: 'wheel' });
        if (!this.parent.options.passiveWheel) {
          event.preventDefault();
        }
        if (this.parent.options.stopPropagation) {
          event.stopPropagation();
        }

        return true;
      }
    }

    return false;
  }

  public resume(): void {
    this.last = null;
    this.paused = false;
  }

  public clamp(): void {
    const decelerate: Partial<Decelerate> = this.parent.plugins.get('decelerate', true) || {};

    if (this.options.clampWheel !== 'y') {
      if (this.parent.screenWorldWidth < this.parent.screenWidth) {
        switch (this.underflowX) {
          case -1:
            this.parent.x = 0;
            break;
          case 1:
            this.parent.x = this.parent.screenWidth - this.parent.screenWorldWidth;
            break;
          default:
            this.parent.x = (this.parent.screenWidth - this.parent.screenWorldWidth) / 2;
        }
      } else if (this.parent.left < 0) {
        this.parent.x = 0;
        decelerate.x = 0;
      } else if (this.parent.right > this.parent.worldWidth) {
        this.parent.x = -this.parent.worldWidth * this.parent.scale.x + this.parent.screenWidth;
        decelerate.x = 0;
      }
    }
    if (this.options.clampWheel !== 'x') {
      if (this.parent.screenWorldHeight < this.parent.screenHeight) {
        switch (this.underflowY) {
          case -1:
            this.parent.y = 0;
            break;
          case 1:
            this.parent.y = this.parent.screenHeight - this.parent.screenWorldHeight;
            break;
          default:
            this.parent.y = (this.parent.screenHeight - this.parent.screenWorldHeight) / 2;
        }
      } else {
        if (this.parent.top < 0) {
          this.parent.y = 0;
          decelerate.y = 0;
        }
        if (this.parent.bottom > this.parent.worldHeight) {
          this.parent.y = -this.parent.worldHeight * this.parent.scale.y + this.parent.screenHeight;
          decelerate.y = 0;
        }
      }
    }
  }
}
