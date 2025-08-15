//! Cloned from pixi-viewport Wheel plugin.

import { events } from '@/app/events/events';
import { intersects } from '@/app/gridGL/helpers/intersects';
import { CELL_HEIGHT } from '@/shared/constants/gridConstants';
import { isMac } from '@/shared/utils/isMac';
import type { Viewport } from 'pixi-viewport';
import { Plugin } from 'pixi-viewport';
import type { IPointData } from 'pixi.js';
import { Point } from 'pixi.js';

export const SCALE_OUT_OF_BOUNDS_SCROLL = 0.1;

const MAX_RUBBER_BAND_GAP = 0;
const RUBBER_BAND_DECELERATION_POWER = 5;

/** Options for {@link Wheel}. */
export interface IWheelOptions {
  /**
   * Percent to scroll with each spin
   *
   * @default 0.1
   */
  percent?: number;

  /**
   * smooth the zooming by providing the number of frames to zoom between wheel spins
   *
   * @default false
   */
  smooth?: false | number;

  /**
   * Stop smoothing with any user input on the viewport
   *
   * @default true
   */
  interrupt?: boolean;

  /**
   * Reverse the direction of the scroll
   *
   * @default false
   */
  reverse?: boolean;

  /**
   * Place this point at center during zoom instead of current mouse position
   *
   * @default null
   */
  center?: Point | null;

  /**
   * Scaling factor for non-DOM_DELTA_PIXEL scrolling events
   *
   * @default 20
   */
  lineHeight?: number;

  /**
   * Axis to zoom
   *
   * @default 'all'
   */
  axis?: 'all' | 'x' | 'y';

  /**
   * Array containing {@link key|https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/code} codes of
   * keys that can be pressed for the zoom to be triggered, e.g.: ['ShiftLeft', 'ShiftRight'}.
   *
   * @default null
   */
  keyToPress?: string[] | null;

  /**
   * pinch the trackpad to zoom
   */
  trackpadPinch?: boolean;

  /**
   * zooms on wheel spin (use this as an alternative to drag.options.wheel)
   */
  wheelZoom?: boolean;
}

export const ZOOM_KEY = ['ControlKey', 'ControlLeft', 'ControlRight', 'MetaKey', 'MetaLeft', 'MetaRight'];

export const HORIZONTAL_SCROLL_KEY = ['ShiftLeft', 'ShiftRight'];

const DEFAULT_WHEEL_OPTIONS: Required<IWheelOptions> = {
  percent: 0.1,
  smooth: false,
  interrupt: true,
  reverse: false,
  center: null,
  lineHeight: 20,
  axis: 'all',
  keyToPress: null,
  trackpadPinch: false,
  wheelZoom: true,
};

/**
 * Plugin for handling wheel scrolling for viewport zoom.
 *
 * @event wheel({wheel: {dx, dy, dz}, event, viewport})
 */
export class Wheel extends Plugin {
  public readonly options: Required<IWheelOptions>;

  protected smoothing?: IPointData | null;
  protected smoothingCenter?: Point | null;
  protected smoothingCount?: number;

  /** Flags whether the keys required to zoom are pressed currently. */
  protected zoomKeyIsPressed: boolean;

  /** Flags whether the keys required to horizontal scrolling are currently pressed. */
  protected horizontalScrollKeyIsPressed: boolean;

  /** Flags whether the viewport is currently zooming using ctrl key + wheel. */
  protected currentlyZooming: boolean;

  protected headingSize: { width: number; height: number } = { width: CELL_HEIGHT, height: CELL_HEIGHT };

  /**
   * This is called by {@link Viewport.wheel}.
   */
  constructor(parent: Viewport, options: IWheelOptions = {}) {
    super(parent);
    this.options = Object.assign({}, DEFAULT_WHEEL_OPTIONS, options);
    this.zoomKeyIsPressed = false;
    this.horizontalScrollKeyIsPressed = false;
    this.currentlyZooming = false;
    if (this.options.keyToPress) {
      this.handleKeyPresses(this.options.keyToPress);
    }
    window.addEventListener('blur', this.handleBlur);
    window.addEventListener('pointerup', this.checkAndEmitZoomEnd);
    window.addEventListener('pointerdown', this.checkAndEmitZoomEnd);
    window.addEventListener('pointerout', this.checkAndEmitZoomEnd);
    window.addEventListener('pointerleave', this.checkAndEmitZoomEnd);

    window.addEventListener('wheel', this.wheelHandler, { passive: false });

    events.on('headingSize', (width, height) => {
      this.headingSize = { width, height };
    });
  }

  private handleBlur = (): void => {
    this.zoomKeyIsPressed = false;
    this.horizontalScrollKeyIsPressed = false;
    this.checkAndEmitZoomEnd();
  };

  /**
   * Handles keypress events and set the keyIsPressed boolean accordingly
   *
   * @param {array} codes - key codes that can be used to trigger zoom event
   */
  protected handleKeyPresses(codes: string[]): void {
    window.addEventListener('keydown', (e) => {
      if (this.isZoomKey(e.code)) {
        this.zoomKeyIsPressed = true;
      }
      if (this.isHorizontalScrollKey(e.code)) {
        this.horizontalScrollKeyIsPressed = true;
      }
      this.checkAndEmitZoomEnd();
    });

    window.addEventListener('keyup', (e) => {
      if (this.isZoomKey(e.code)) {
        this.zoomKeyIsPressed = false;
      }
      if (this.isHorizontalScrollKey(e.code)) {
        this.horizontalScrollKeyIsPressed = false;
      }
      this.checkAndEmitZoomEnd();
    });
  }

  public down(): boolean {
    if (this.options.interrupt) {
      this.smoothing = null;
    }

    return false;
  }

  protected isAxisX(): boolean {
    return ['all', 'x'].includes(this.options.axis);
  }

  protected isAxisY(): boolean {
    return ['all', 'y'].includes(this.options.axis);
  }

  protected isZoomKey(key: string): key is (typeof ZOOM_KEY)[number] {
    return ZOOM_KEY.includes(key);
  }

  protected isHorizontalScrollKey(key: string): key is (typeof HORIZONTAL_SCROLL_KEY)[number] {
    return HORIZONTAL_SCROLL_KEY.includes(key);
  }

  protected emitWaitForZoomEnd = (): void => {
    this.currentlyZooming = true;
    this.parent.emit('wait-for-zoom-end');
  };

  protected checkAndEmitZoomEnd = (): void => {
    if (this.currentlyZooming) {
      this.currentlyZooming = false;
      this.parent.emit('zoom-end');
    }
  };

  public update(): void {
    if (this.smoothing) {
      const point = this.smoothingCenter;
      const change = this.smoothing;
      let oldPoint;

      if (!this.options.center) {
        oldPoint = this.parent.toLocal(point as IPointData);
      }
      if (this.isAxisX()) {
        this.parent.scale.x += change.x;
      }
      if (this.isAxisY()) {
        this.parent.scale.y += change.y;
      }

      this.parent.emit('zoomed', { viewport: this.parent, type: 'wheel' });
      const clamp = this.parent.plugins.get('clamp-zoom', true);

      if (clamp) {
        clamp.clamp();
      }
      if (this.options.center) {
        this.parent.moveCenter(this.options.center);
      } else {
        const newPoint = this.parent.toGlobal(oldPoint as IPointData);

        this.parent.x += (point as IPointData).x - newPoint.x;
        this.parent.y += (point as IPointData).y - newPoint.y;
      }

      this.parent.emit('moved', { viewport: this.parent, type: 'wheel' });
      (this.smoothingCount as number)++;

      if ((this.smoothingCount as number) >= (this.options.smooth as number)) {
        this.smoothing = null;
      }
    }
  }

  // adjust is used to move the event for IFrames
  private getPointerPosition(e: WheelEvent, adjust?: { x: number; y: number }) {
    const point = new Point();
    this.parent.options.events.mapPositionToPoint(
      point,
      e.clientX + (adjust ? adjust.x : 0),
      e.clientY + (adjust ? adjust.y : 0)
    );
    return point;
  }

  private pinch(e: WheelEvent, adjust?: { x: number; y: number }) {
    if (this.paused) {
      return;
    }

    const point = this.getPointerPosition(e, adjust);
    const step = (-e.deltaY * (e.deltaMode ? this.options.lineHeight : 1)) / 200;
    const change = Math.pow(2, (1 + this.options.percent) * step);

    let oldPoint: IPointData | undefined;

    if (!this.options.center) {
      oldPoint = this.parent.toLocal(point);
    }
    if (this.isAxisX()) {
      this.parent.scale.x *= change;
    }
    if (this.isAxisY()) {
      this.parent.scale.y *= change;
    }
    this.parent.emit('zoomed', { viewport: this.parent, type: 'wheel' });
    const clamp = this.parent.plugins.get('clamp-zoom', true);

    if (clamp) {
      clamp.clamp();
    }
    if (this.options.center) {
      this.parent.moveCenter(this.options.center);
    } else {
      const newPoint = this.parent.toGlobal(oldPoint as IPointData);

      this.parent.x += point.x - newPoint.x;
      this.parent.y += point.y - newPoint.y;
    }

    this.parent.emit('moved', { viewport: this.parent, type: 'wheel' });
    this.parent.emit('wheel-start', {
      event: e,
      viewport: this.parent,
    });
  }

  // This is a hack to double check that the zoom key is pressed. This fixes a
  // bug where the zoom key is pressed when on the app, but the keyup is not
  // caught b/c an external program is called (eg, taking a screen shot with
  // meta+4)
  private doubleCheckZoomKey(e: WheelEvent) {
    if (this.zoomKeyIsPressed && !e.ctrlKey && !e.metaKey) {
      this.zoomKeyIsPressed = false;
    }
  }

  public wheel(e: WheelEvent, adjust?: { x: number; y: number }): boolean {
    // on normal operation, skip the wheel handler as it's handled with a
    // non-passive version in this object
    if (adjust) {
      return this.wheelSpecial(e, adjust);
    }
    return true;
  }

  public wheelHandler = (e: WheelEvent) => {
    const target = e.target as HTMLElement;
    const adjust = { x: target.scrollLeft, y: target.scrollTop };
    const point = this.getPointerPosition(e, adjust);
    const bounds = this.parent.getVisibleBounds();
    console.log({ bounds, point });
    if (!intersects.rectanglePoint(bounds, point)) {
      console.log('not in bounds');
      return;
    }
    console.log('in bounds');
    return this.wheelSpecial(e, adjust);
  };

  public wheelSpecial = (e: WheelEvent, adjust?: { x: number; y: number }): boolean => {
    console.log('wheelSpecial');
    this.doubleCheckZoomKey(e);

    // If paused or both zoom and horizontal keys are pressed do nothing
    if (this.paused || (this.zoomKeyIsPressed && this.horizontalScrollKeyIsPressed)) {
      return false;
    }
    if (this.zoomKeyIsPressed) {
      const point = this.getPointerPosition(e);
      const sign = this.options.reverse ? -1 : 1;
      const step = (sign * -e.deltaY * (e.deltaMode ? this.options.lineHeight : 1)) / 500;
      const change = Math.pow(2, (1 + this.options.percent) * step);

      if (this.options.smooth) {
        const original = {
          x: this.smoothing ? this.smoothing.x * (this.options.smooth - (this.smoothingCount as number)) : 0,
          y: this.smoothing ? this.smoothing.y * (this.options.smooth - (this.smoothingCount as number)) : 0,
        };

        this.smoothing = {
          x: ((this.parent.scale.x + original.x) * change - this.parent.scale.x) / this.options.smooth,
          y: ((this.parent.scale.y + original.y) * change - this.parent.scale.y) / this.options.smooth,
        };
        this.smoothingCount = 0;
        this.smoothingCenter = point;
      } else {
        let oldPoint: IPointData | undefined;

        if (!this.options.center) {
          oldPoint = this.parent.toLocal(point);
        }
        if (this.isAxisX()) {
          this.parent.scale.x *= change;
        }
        if (this.isAxisY()) {
          this.parent.scale.y *= change;
        }
        this.parent.emit('zoomed', { viewport: this.parent, type: 'wheel' });
        this.emitWaitForZoomEnd();
        const clamp = this.parent.plugins.get('clamp-zoom', true);

        if (clamp) {
          clamp.clamp();
        }
        if (this.options.center) {
          this.parent.moveCenter(this.options.center);
        } else {
          const newPoint = this.parent.toGlobal(oldPoint as IPointData);

          this.parent.x += point.x - newPoint.x;
          this.parent.y += point.y - newPoint.y;
        }
      }

      this.parent.emit('moved', { viewport: this.parent, type: 'wheel' });
      this.parent.emit('wheel-start', {
        wheel: { dx: e.deltaX, dy: e.deltaY, dz: e.deltaZ },
        event: e,
        viewport: this.parent,
      });
    } else if (e.ctrlKey && this.options.trackpadPinch) {
      this.pinch(e, adjust);
    } else {
      const deltas = [e.deltaX, e.deltaY];
      const [deltaX, deltaY] = deltas;

      const { x: viewportX, y: viewportY } = this.parent;
      const { width: headingWidth, height: headingHeight } = this.headingSize;

      const stepX = deltaX < 0 && viewportX > 0 ? SCALE_OUT_OF_BOUNDS_SCROLL : 1;
      const stepY = deltaY < 0 && viewportY > 0 ? SCALE_OUT_OF_BOUNDS_SCROLL : 1;

      // Calculate the scroll amount
      let dx = (this.horizontalScrollKeyIsPressed && !isMac ? deltaY : deltaX) * stepX * -1;
      let dy = (this.horizontalScrollKeyIsPressed && !isMac ? 0 : deltaY) * stepY * -1;

      // Calculate actual position of the viewport after scrolling
      const nextX = viewportX + dx - headingWidth;
      const nextY = viewportY + dy - headingHeight;

      if (viewportX >= headingWidth) {
        // going beyond the heading, decelerate
        const factorX = this.getDecelerationFactor(nextX);
        dx *= factorX;
      } else if (nextX > 0) {
        // snap to the edge
        dx -= nextX;
      }

      if (viewportY >= headingHeight) {
        // going beyond the heading, decelerate
        const factorY = this.getDecelerationFactor(nextY);
        dy *= factorY;
      } else if (nextY > 0) {
        // snap to the edge
        dy -= nextY;
      }

      this.parent.x = viewportX + dx;
      this.parent.y = viewportY + dy;

      this.parent.emit('wheel-scroll', this.parent);
      this.parent.emit('moved', { viewport: this.parent, type: 'wheel' });
    }
    e.stopPropagation();
    e.preventDefault();
    return !this.parent.options.passiveWheel;
  };

  private getDecelerationFactor(value: number): number {
    // No deceleration needed if the value is less than or equal to 0
    if (value <= 0) return 1;

    // Normalize the gap to be between 0 and 1
    const normalizedGap = Math.min(value / MAX_RUBBER_BAND_GAP, 1);

    // Calculate the deceleration factor using a power function
    const factor = Math.pow(1 - normalizedGap, RUBBER_BAND_DECELERATION_POWER);

    return factor;
  }
}
