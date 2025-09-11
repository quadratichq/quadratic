import { debugFlag } from '@/app/debugFlags/debugFlags';
import { events } from '@/app/events/events';
import { debugRendererLight, debugTimeCheck, debugTimeReset } from '@/app/gridGL/helpers/debugPerformance';
import { FPS } from '@/app/gridGL/helpers/Fps';
import { content } from '@/app/gridGL/pixiApp/Content';
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
      console.log('current focus:', focus);
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

    if (content.copying) {
      this.raf = requestAnimationFrame(this.update);
      return;
    }

    if (!content.cellsSheets.isReady()) {
      this.raf = requestAnimationFrame(this.update);
      return;
    }

    if (debugFlag('debugShowFocus')) {
      this.showFocus();
    }

    const viewportChanged = pixiApp.viewport.updateViewport();
    if (viewportChanged && debugFlag('debugShowWhyRendering')) {
      console.log('dirty: pixiApp viewport');
    }

    debugTimeCheck('[Update] scrollbars');

    const contentDirty = content.update(viewportChanged);

    if (pixiApp.viewport.dirty || contentDirty) {
      debugTimeReset();
      pixiApp.viewport.dirty = false;
      pixiApp.renderer.render(pixiApp.stage);
      debugTimeCheck('[Update] render');
      debugRendererLight(true);
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
