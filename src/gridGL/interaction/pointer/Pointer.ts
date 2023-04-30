import { InteractionEvent } from 'pixi.js';
import { PointerHeading } from './PointerHeading';
import { PointerDown } from './PointerDown';
import { PointerAutoComplete } from './PointerAutoComplete/PointerAutoComplete';
import { PointerCursor } from './pointerCursor';
import { PixiApp } from 'gridGL/pixiApp/PixiApp';

export class Pointer {
  private app: PixiApp;
  pointerHeading: PointerHeading;
  pointerAutoComplete: PointerAutoComplete;
  private pointerCursor: PointerCursor;

  pointerDown: PointerDown;

  constructor(app: PixiApp) {
    this.app = app;
    this.pointerHeading = new PointerHeading(app);
    this.pointerAutoComplete = new PointerAutoComplete(app);
    this.pointerDown = new PointerDown(app);
    this.pointerCursor = new PointerCursor(app);
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
    this.pointerHeading.pointerDown(world, event) ||
      this.pointerAutoComplete.pointerDown(world) ||
      this.pointerDown.pointerDown(world, event);
  };

  private pointerMove = (e: InteractionEvent): void => {
    const world = this.app.viewport.toWorld(e.data.global);
    this.pointerHeading.pointerMove(world) ||
      this.pointerAutoComplete.pointerMove(world) ||
      this.pointerDown.pointerMove(world);
    this.pointerCursor.pointerMove();
  };

  private pointerUp = (): void => {
    this.pointerHeading.pointerUp() || this.pointerAutoComplete.pointerUp() || this.pointerDown.pointerUp();
  };

  handleEscape(): boolean {
    return this.pointerHeading.handleEscape() || this.pointerAutoComplete.handleEscape();
  }
}
