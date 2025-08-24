import { debugFlag } from '@/app/debugFlags/debugFlags';
import { events } from '@/app/events/events';
import {
  debugRendererLight,
  debugShowChildren,
  debugTimeCheck,
  debugTimeReset,
} from '@/app/gridGL/helpers/debugPerformance';
import { FPS } from '@/app/gridGL/helpers/Fps';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { thumbnail } from '@/app/gridGL/pixiApp/thumbnail';

export class Update {
  private raf?: number;
  private fps?: FPS;

  firstRenderComplete = false;

  constructor() {
    if (debugFlag('debugShowFPS')) {
      this.fps = new FPS();
    }
  }

  start() {
    if (!this.raf) {
      this.raf = requestAnimationFrame(this.update);
    }
  }

  destroy() {
    if (this.raf) {
      cancelAnimationFrame(this.raf);
      this.raf = undefined;
    }
  }

  private lastFocusElement?: HTMLElement;
  private showFocus = () => {
    const focus = document.activeElement;
    if (focus !== this.lastFocusElement) {
      this.lastFocusElement = focus as HTMLElement;
    }
  };

  private updateFps() {
    if (!this.fps && debugFlag('debugShowFPS')) {
      this.fps = new FPS();
    }
    this.fps?.update();
  }

  // update loop w/debug checks
  private update = () => {
    if (pixiApp.destroyed) return;

    if (pixiApp.copying) {
      this.raf = requestAnimationFrame(this.update);
      return;
    }

    if (!pixiApp.cellsSheets.isReady()) {
      this.raf = requestAnimationFrame(this.update);
      return;
    }

    if (debugFlag('debugShowFocus')) {
      this.showFocus();
    }

    const rendererDirty = this.updateOnly(pixiApp);

    if (pixiApp.viewport.dirty || rendererDirty) {
      debugTimeReset();
      pixiApp.viewport.dirty = false;
      pixiApp.renderer.render(pixiApp.stage);
      debugTimeCheck('[Update] render');
      debugRendererLight(true);
      debugShowChildren(pixiApp.stage, 'stage');
      thumbnail.rendererBusy();
      events.emit('viewportReadyAfterUpdate');
    } else {
      debugRendererLight(false);
      thumbnail.check();
    }

    if (!this.firstRenderComplete) {
      this.firstRenderComplete = true;
      pixiApp.viewport.loadViewport();
    }

    this.raf = requestAnimationFrame(this.update);
    this.updateFps();
  };
}
