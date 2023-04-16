import { InteractionEvent } from 'pixi.js';
import { PointerHeading } from './PointerHeading';
import { PointerDown } from './PointerDown';
import { PixiApp } from 'gridGL/pixiApp/PixiApp';

export class Pointer {
  private app: PixiApp;
  private headingResize: PointerHeading;
  pointerDown: PointerDown;

  constructor(app: PixiApp) {
    this.app = app;
    this.headingResize = new PointerHeading(app);
    this.pointerDown = new PointerDown(app);
    const viewport = app.viewport;
    viewport.on('pointerdown', this.handlePointerDown);
    viewport.on('pointermove', this.pointerMove);
    viewport.on('pointerup', this.pointerUp);
    viewport.on('pointerupoutside', this.pointerUp);
  }

  destroy() {
    const viewport = this.app.viewport;
    viewport.off('pointerdown', this.handlePointerDown);
    viewport.off('pointermove', this.pointerMove);
    viewport.off('pointerup', this.pointerUp);
    viewport.off('pointerupoutside', this.pointerUp);
    this.pointerDown.destroy();
  }

  private handlePointerDown = (e: InteractionEvent): void => {
    const world = this.app.viewport.toWorld(e.data.global);
    const event = e.data.originalEvent;
    this.headingResize.pointerDown(world, event) || this.pointerDown.pointerDown(world, event as PointerEvent);
  };

  private pointerMove = (e: InteractionEvent): void => {
    const world = this.app.viewport.toWorld(e.data.global);
    this.headingResize.pointerMove(world) || this.pointerDown.pointerMove(world);
  };

  private pointerUp = (): void => {
    this.headingResize.pointerUp() || this.pointerDown.pointerUp();
  };

  handleEscape(): boolean {
    return this.headingResize.handleEscape();
  }
}
