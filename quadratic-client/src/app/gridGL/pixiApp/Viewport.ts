import { Drag, Viewport as PixiViewport } from 'pixi-viewport';
import { Point } from 'pixi.js';
import type { Rectangle } from 'pixi.js';
import { isMobile } from 'react-device-detect';

import { sheets } from '@/app/grid/controller/Sheets';
import { HORIZONTAL_SCROLL_KEY, Wheel, ZOOM_KEY } from '@/app/gridGL/pixiOverride/Wheel';

const MULTIPLAYER_VIEWPORT_EASE_TIME = 100;
const MINIMUM_VIEWPORT_SCALE = 0.01;
const MAXIMUM_VIEWPORT_SCALE = 10;
const WHEEL_ZOOM_PERCENT = 1.5;

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
  }

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
