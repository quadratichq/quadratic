import { InteractionEvent } from 'pixi.js';
import { PixiApp } from '../../pixiApp/PixiApp';
import { PointerDown } from '../pointer/PointerDown';

export class FileUploadIndicator {
  private app: PixiApp;
  pointerDown: PointerDown;

  constructor(app: PixiApp) {
    this.app = app;
    this.pointerDown = new PointerDown(app);
    const viewport = app.viewport;
    viewport.on('pointermove', this.pointerMove);
  }

  destroy() {
    const viewport = this.app.viewport;
    viewport.off('pointermove', this.pointerMove);
  }

  private pointerMove = (e: InteractionEvent): void => {
    this.app.canvas.style.cursor = 'auto';
    const world = this.app.viewport.toWorld(e.data.global);
    const event = e.data.originalEvent;

    console.log('pointerMove', world, event);
    this.pointerDown.pointerDown(world, event as PointerEvent);
  };
}
