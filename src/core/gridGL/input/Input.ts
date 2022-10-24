import { InteractionEvent } from 'pixi.js';
import { PixiApp } from '../pixiApp/PixiApp';
import { HeadingResize } from './HeadingResize';
import { InputDown } from './InputDown';

export class Input {
  private app: PixiApp;
  private headingResize: HeadingResize;
  private inputDown: InputDown;

  constructor(app: PixiApp) {
    this.app = app;
    this.headingResize = new HeadingResize(app);
    this.inputDown = new InputDown(app);
    const viewport = app.viewport;
    viewport.on('pointerdown', this.pointerDown);
    viewport.on('pointermove', this.pointerMove);
    viewport.on('pointerup', this.pointerUp);
    viewport.on('pointerupoutside', this.pointerUp);
  }

  destroy() {
    const viewport = this.app.viewport;
    viewport.off('pointerdown', this.pointerDown);
    viewport.off('pointermove', this.pointerMove);
    viewport.off('pointerup', this.pointerUp);
    viewport.off('pointerupoutside', this.pointerUp);
  }

  private pointerDown = (e: InteractionEvent): void => {
    const world = this.app.viewport.toWorld(e.data.global);
    const event = e.data.originalEvent;
    this.headingResize.pointerDown(world, event) || this.inputDown.pointerDown(world, event as PointerEvent);
  }

  private pointerMove = (e: InteractionEvent): void => {
    const world = this.app.viewport.toWorld(e.data.global);
    this.headingResize.pointerMove(world) || this.inputDown.pointerMove(world);
  }

  private pointerUp = (): void => {
    this.headingResize.pointerUp() || this.inputDown.pointerUp();
  }
}