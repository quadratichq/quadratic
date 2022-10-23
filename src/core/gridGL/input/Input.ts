import { PixiApp } from '../pixiApp/PixiApp';

export class Input {
  private app: PixiApp;

  constructor(app: PixiApp) {
    this.app = app;
    const stage = app.stage;
    stage.on('pointerdown', this.pointerDown);
    stage.on('pointermove', this.pointerMove);
    stage.on('pointerup', this.pointerUp);
    stage.on('pointerupoutside', this.pointerUp);
  }

  destroy() {
    const stage = this.app.stage;
    stage.off('pointerdown', this.pointerDown);
    stage.off('pointermove', this.pointerMove);
    stage.off('pointerup', this.pointerUp);
    stage.off('pointerupoutside', this.pointerUp);
  }

  private pointerDown = (e: PointerEvent): void => {}

  private pointerMove = (e: PointerEvent): void => {}

  private pointerUp = (e: PointerEvent): void => {}
}