import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { renderWebWorker } from '@/app/web-workers/renderWebWorker/renderWebWorker';
import { Viewport as PixiViewport } from 'pixi-viewport';
import { Point, Rectangle } from 'pixi.js';
import { isMobile } from 'react-device-detect';
import { pixiApp } from '../PixiApp';
import { Drag } from './Drag';
import { HORIZONTAL_SCROLL_KEY, Wheel, ZOOM_KEY } from './Wheel';

const MULTIPLAYER_VIEWPORT_EASE_TIME = 100;
const MINIMUM_VIEWPORT_SCALE = 0.01;
const MAXIMUM_VIEWPORT_SCALE = 10;
const WHEEL_ZOOM_PERCENT = 1.5;

const WAIT_TO_SNAP_TIME = 250;
const SNAPPING_TIME = 150;

export class Viewport extends PixiViewport {
  private lastViewportPosition: Point = new Point();

  // setting this to 0 ensures that on initial render, the viewport is properly scaled and updated
  private lastViewportScale = 0;

  private lastScreenWidth = 0;
  private lastScreenHeight = 0;

  private lastSheetId = '';

  private snapState?: 'waiting' | 'snapping' | undefined;
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
    this.decelerate().pinch().clampZoom({
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

    this.on('moved', () => events.emit('viewportChanged'));
    this.on('zoomed', () => events.emit('viewportChanged'));
    this.on('snap-end', this.handleSnapEnd);
  }

  destroy() {
    if (this.snapTimeout) {
      clearTimeout(this.snapTimeout);
    }
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
    const bounds = pixiApp.viewport.getVisibleBounds();
    const scale = pixiApp.viewport.scale.x;
    renderWebWorker.updateViewport(sheets.sheet.id, bounds, scale);
  }

  private startSnap = () => {
    this.snapTimeout = window.setTimeout(() => {
      const headings = pixiApp.headings.headingSize;
      this.snap(-headings.width / this.scale.x, -headings.height / this.scale.y, {
        topLeft: true,
        time: SNAPPING_TIME,
        ease: 'easeInOutSine',
        removeOnComplete: true,
        interrupt: true,
        friction: 1,
      });
      this.snapState = 'snapping';
    }, WAIT_TO_SNAP_TIME);
  };

  updateViewport(): void {
    const { viewport } = pixiApp;

    let dirty = false;
    if (this.lastViewportScale !== viewport.scale.x) {
      this.lastViewportScale = viewport.scale.x;
      dirty = true;

      // this is used to trigger changes to ZoomDropdown
      events.emit('zoom', viewport.scale.x);
    }
    if (this.lastViewportPosition.x !== viewport.x || this.lastViewportPosition.y !== viewport.y) {
      this.lastViewportPosition.x = viewport.x;
      this.lastViewportPosition.y = viewport.y;
      dirty = true;
    }
    if (this.lastScreenWidth !== viewport.screenWidth || this.lastScreenHeight !== viewport.screenHeight) {
      this.lastScreenWidth = viewport.screenWidth;
      this.lastScreenHeight = viewport.screenHeight;
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

      // if we're already waiting to snap, then cancel the timeout
      if (this.snapState === 'waiting') {
        clearTimeout(this.snapTimeout);
        this.snapTimeout = undefined;
        this.snapState = undefined;
      }
    } else if (this.snapState === undefined) {
      const headings = pixiApp.headings.headingSize;
      if (this.x - headings.width > 0 || this.y - headings.height > 0) {
        this.snapState = 'waiting';
        this.startSnap();
      }
    }
  }

  private handleSnapEnd = () => {
    this.snapState = undefined;
    this.snapTimeout = undefined;
  };
}
