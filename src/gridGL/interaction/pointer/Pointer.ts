import { InteractionEvent } from 'pixi.js';
import { PixiApp } from '../../pixiApp/PixiApp';
import { PointerHeading } from './PointerHeading';
import { PointerDown } from './PointerDown';
import { PointerAutoComplete } from './PointerAutoComplete';

export class Pointer {
  private app: PixiApp;
  private headingResize: PointerHeading;
  private pointerAutoComplete: PointerAutoComplete;
  pointerDown: PointerDown;

  constructor(app: PixiApp) {
    this.app = app;
    this.headingResize = new PointerHeading(app);
    this.pointerAutoComplete = new PointerAutoComplete(app);
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
    const event = e.data.originalEvent as PointerEvent;
    this.headingResize.pointerDown(world, event) ||
      this.pointerAutoComplete.pointerDown(world) ||
      this.pointerDown.pointerDown(world, event);
  };

  private pointerMove = (e: InteractionEvent): void => {
    const world = this.app.viewport.toWorld(e.data.global);
    this.headingResize.pointerMove(world) ||
      this.pointerAutoComplete.pointerMove(world) ||
      this.pointerDown.pointerMove(world);
  };

  private pointerUp = (): void => {
    this.headingResize.pointerUp() || this.pointerAutoComplete.pointerUp() || this.pointerDown.pointerUp();
  };

  handleEscape(): boolean {
    return this.headingResize.handleEscape() || this.pointerAutoComplete.handleEscape();
  }
}
