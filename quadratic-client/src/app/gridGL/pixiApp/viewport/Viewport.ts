import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { Decelerate } from '@/app/gridGL/pixiApp/viewport/Decelerate';
import { Drag } from '@/app/gridGL/pixiApp/viewport/Drag';
import { HORIZONTAL_SCROLL_KEY, Wheel, ZOOM_KEY } from '@/app/gridGL/pixiApp/viewport/Wheel';
import { renderWebWorker } from '@/app/web-workers/renderWebWorker/renderWebWorker';
import { Viewport as PixiViewport } from 'pixi-viewport';
import { Point, Rectangle } from 'pixi.js';
import { isMobile } from 'react-device-detect';

const MULTIPLAYER_VIEWPORT_EASE_TIME = 100;
const MINIMUM_VIEWPORT_SCALE = 0.01;
const MAXIMUM_VIEWPORT_SCALE = 10;
const WHEEL_ZOOM_PERCENT = 1.5;

const WAIT_TO_SNAP_TIME = 200;
const SNAPPING_TIME = 150;

type SnapState = 'waiting' | 'snapping' | undefined;

export class Viewport extends PixiViewport {
  private lastViewportPosition: Point = new Point();

  // setting this to 0 ensures that on initial render, the viewport is properly scaled and updated
  private lastViewportScale = 0;

  private lastScreenWidth = 0;
  private lastScreenHeight = 0;

  private lastSheetId = '';

  private waitForZoomEnd = false;

  private snapState?: SnapState;
  private snapTimeout?: number;

  constructor() {
    super();
    this.plugins.add(
      'drag',
      new Drag(this, {
        pressDrag: true,
        wheel: false, // handled by Wheel plugin below
        keyToPress: ['Space'],
      })
    );
    this.plugins.add('decelerate', new Decelerate(this));
    this.pinch().clampZoom({
      minScale: MINIMUM_VIEWPORT_SCALE,
      maxScale: MAXIMUM_VIEWPORT_SCALE,
    });
    this.plugins.add(
      'wheel',
      new Wheel(this, {
        trackpadPinch: true,
        wheelZoom: true,
        percent: WHEEL_ZOOM_PERCENT,
        keyToPress: [...ZOOM_KEY, ...HORIZONTAL_SCROLL_KEY],
      })
    );
    if (!isMobile) {
      this.plugins.add(
        'drag-middle-mouse',
        new Drag(this, {
          pressToDrag: true,
          mouseButtons: 'middle',
          wheel: 'false',
        })
      );
    }

    // hack to ensure pointermove works outside of canvas
    this.off('pointerout');

    this.on('moved', this.viewportChanged);
    this.on('zoomed', this.viewportChanged);
    this.on('wait-for-zoom-end', this.handleWaitForZoomEnd);
    this.on('zoom-end', this.handleZoomEnd);
    this.on('snap-end', this.handleSnapEnd);
  }

  private viewportChanged = () => {
    events.emit('viewportChanged');
  };

  destroy() {
    this.off('moved', this.viewportChanged);
    this.off('zoomed', this.viewportChanged);
    this.off('wait-for-zoom-end', this.handleWaitForZoomEnd);
    this.off('zoom-end', this.handleZoomEnd);
    this.off('snap-end', this.handleSnapEnd);
  }

  loadViewport() {
    const vp = sheets.sheet.cursor.viewport;
    if (vp) {
      this.position.set(vp.x, vp.y);
      this.scale.set(vp.scaleX, vp.scaleY);
      this.dirty = true;
    }
  }

  loadMultiplayerViewport(options: { x: number; y: number; bounds: Rectangle; sheetId: string }): void {
    const { x, y, bounds } = options;
    let width: number | undefined;
    let height: number | undefined;

    // ensure the entire follow-ee's bounds is visible to the current user
    if (this.screenWidth / this.screenHeight > bounds.width / bounds.height) {
      height = bounds.height;
    } else {
      width = bounds.width;
    }
    if (sheets.current !== options.sheetId) {
      sheets.current = options.sheetId;
      this.moveCenter(new Point(x, y));
    } else {
      this.animate({
        position: new Point(x, y),
        width,
        height,
        removeOnInterrupt: true,
        time: MULTIPLAYER_VIEWPORT_EASE_TIME,
      });
    }
    this.dirty = true;
  }

  // resets the viewport to start
  reset() {
    const headings = pixiApp.headings.headingSize;
    this.position.set(headings.width, headings.height);
    this.dirty = true;
  }

  sendRenderViewport() {
    const bounds = this.getVisibleBounds();
    const scale = this.scale.x;
    renderWebWorker.updateViewport(sheets.sheet.id, bounds, scale);
  }

  private startSnap = () => {
    const headings = pixiApp.headings.headingSize;
    let x: number;
    let y: number;
    let snap = false;
    if (this.x > headings.width) {
      x = -headings.width / this.scaled;
      snap = true;
    } else {
      x = -this.x / this.scaled;
    }
    if (this.y > headings.height) {
      y = -headings.height / this.scaled;
      snap = true;
    } else {
      y = -this.y / this.scaled;
    }
    if (snap) {
      this.snap(x, y, {
        topLeft: true,
        time: SNAPPING_TIME,
        ease: 'easeOutSine',
        removeOnComplete: true,
        interrupt: true,
      });
      this.snapState = 'snapping';
    } else {
      this.snapState = undefined;
    }
  };

  updateViewport(): void {
    let dirty = false;
    if (this.lastViewportScale !== this.scale.x) {
      this.lastViewportScale = this.scale.x;
      dirty = true;

      // this is used to trigger changes to ZoomDropdown
      events.emit('zoom', this.scale.x);
    }
    if (this.lastViewportPosition.x !== this.x || this.lastViewportPosition.y !== this.y) {
      this.lastViewportPosition.x = this.x;
      this.lastViewportPosition.y = this.y;
      dirty = true;
    }
    if (this.lastScreenWidth !== this.screenWidth || this.lastScreenHeight !== this.screenHeight) {
      this.lastScreenWidth = this.screenWidth;
      this.lastScreenHeight = this.screenHeight;
      dirty = true;
    }
    if (this.lastSheetId !== sheets.sheet.id) {
      this.lastSheetId = sheets.sheet.id;
      dirty = true;
    }
    if (dirty) {
      pixiApp.viewportChanged();
      this.sendRenderViewport();

      // signals to react that the viewport has changed (so it can update any
      // related positioning)
      events.emit('viewportChangedReady');

      // Clear both timeout and state when interrupting a waiting snap
      this.snapTimeout = undefined;
      this.snapState = undefined;
    } else if (!this.waitForZoomEnd) {
      if (!this.snapState) {
        const headings = pixiApp.headings.headingSize;
        if (this.x > headings.width || this.y > headings.height) {
          this.snapTimeout = Date.now();
          this.snapState = 'waiting';
        }
      } else if (this.snapState === 'waiting' && this.snapTimeout) {
        if (Date.now() - this.snapTimeout > WAIT_TO_SNAP_TIME) {
          this.startSnap();
        }
      }
    }
  }

  private handleWaitForZoomEnd = () => {
    this.waitForZoomEnd = true;
  };

  private handleZoomEnd = () => {
    this.waitForZoomEnd = false;
    this.startSnap();
  };

  private handleSnapEnd = () => {
    this.snapState = undefined;
    this.snapTimeout = undefined;
  };
}
