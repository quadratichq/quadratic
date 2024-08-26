import { sheets } from '@/app/grid/controller/Sheets';
import { Drag, Viewport as PixiViewport } from 'pixi-viewport';
import { Point, Rectangle } from 'pixi.js';
import { isMobile } from 'react-device-detect';
import { HORIZONTAL_SCROLL_KEY, Wheel, ZOOM_KEY } from '../pixiOverride/Wheel';
import { CELL_HEIGHT, CELL_WIDTH } from '@/shared/constants/gridConstants';
import { pixiApp } from './PixiApp';
import debounce from 'lodash.debounce';
import { isCellVisible } from '../interaction/viewportHelper';

const MULTIPLAYER_VIEWPORT_EASE_TIME = 100;
const MINIMUM_VIEWPORT_SCALE = 0.01;
const MAXIMUM_VIEWPORT_SCALE = 10;
const WHEEL_ZOOM_PERCENT = 1.5;

// bounce when the viewport is moved beyond the content/sheet size
const BOUNCE_BACK_HORIZONTAL_CELLS = 1;
const BOUNCE_BACK_VERTICAL_CELLS = 1;
const BOUNCE_BACK_TIME = 250;
const DEBOUNCE_TIME = 500;

export class Viewport extends PixiViewport {
  constructor() {
    super();
    this.drag({
      pressDrag: true,
      wheel: false, // handled by Wheel plugin below
      ...(isMobile ? {} : { keyToPress: ['Space'] }),
    })
      .decelerate()
      .pinch()
      .clampZoom({
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

    // bounce back the viewport when content is out of view
    this.on('moved-end', debounce(this.movedEnd, DEBOUNCE_TIME));
  }

  // handle gracefully bouncing the viewport back to the visible bounds
  private movedEnd = () => {
    // don't do anything if cursor's cell is visible (this allows the user to
    // move the viewport out of view with the cursor)
    if (isCellVisible()) return;

    const sheetBounds = sheets.sheet.getScreenBounds();
    const visibleBounds = this.getVisibleBounds();
    let centerX = this.center.x;
    let centerY = this.center.y;
    const minX = sheetBounds ? Math.min(sheetBounds.x, 0) : 0;
    const maxX = sheetBounds ? sheetBounds.right : undefined;
    const maxY = sheetBounds ? sheetBounds.bottom : undefined;

    // handle bouncing from the left/right of the screen
    if (visibleBounds.right < minX) {
      centerX = -visibleBounds.width / 2 + CELL_WIDTH * BOUNCE_BACK_HORIZONTAL_CELLS;
    } else if (maxX !== undefined && visibleBounds.left > maxX) {
      // we need the minus one to account for the fact that the right edge of the screen is not visible
      centerX =
        maxX + visibleBounds.width / 2 - CELL_WIDTH * (BOUNCE_BACK_HORIZONTAL_CELLS - 1) - pixiApp.headings.rowWidth;
    }

    // handle bouncing from the top/bottom of the screen
    if (visibleBounds.bottom < 0) {
      centerY = -visibleBounds.height / 2 + CELL_HEIGHT * BOUNCE_BACK_VERTICAL_CELLS;
    } else if (maxY !== undefined && visibleBounds.top > maxY) {
      centerY = maxY + visibleBounds.height / 2 - CELL_HEIGHT * BOUNCE_BACK_VERTICAL_CELLS;
    }
    if (centerX !== this.center.x || centerY !== this.center.y) {
      this.animate({
        position: new Point(centerX, centerY),
        time: BOUNCE_BACK_TIME,
        removeOnInterrupt: true,
        ease: 'easeInSine',
      });
    }
  };

  loadViewport() {
    const lastViewport = sheets.sheet.cursor.viewport;
    if (lastViewport) {
      this.position.set(lastViewport.x, lastViewport.y);
      this.scale.set(lastViewport.scaleX, lastViewport.scaleY);
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
}
