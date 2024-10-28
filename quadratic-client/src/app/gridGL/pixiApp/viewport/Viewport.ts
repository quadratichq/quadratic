import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
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

export class Viewport extends PixiViewport {
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

  // Clamps viewport to half the screen size
  clampViewportToHalf() {
    const maxX = this.screenWidth / 2;
    if (this.x > maxX) {
      this.x = maxX;
    }
    const maxY = this.screenHeight / 2;
    if (this.y > maxY) {
      this.y = maxY;
    }
  }

  // resets the viewport to start
  reset() {
    const headings = pixiApp.headings.headingSize;
    this.position.set(headings.width, headings.height);
    this.dirty = true;
  }
}
