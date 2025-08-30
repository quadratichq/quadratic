import { debugFlag } from '@/app/debugFlags/debugFlags';
import { events } from '@/app/events/events';
import {
  debugRendererLight,
  debugShowChildren,
  debugTimeCheck,
  debugTimeReset,
} from '@/app/gridGL/helpers/debugPerformance';
import { FPS } from '@/app/gridGL/helpers/Fps';
import type { ScrollBarsHandler } from '@/app/gridGL/HTMLGrid/scrollBars/ScrollBarsHandler';
import { content } from '@/app/gridGL/pixiApp/Content';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { thumbnail } from '@/app/gridGL/pixiApp/thumbnail';

export class Update {
  private raf?: number;
  private fps?: FPS;

  private scrollBarsHandler?: ScrollBarsHandler;

  firstRenderComplete = false;

  constructor() {
    if (debugFlag('debugShowFPS')) {
      this.fps = new FPS();
    }
    events.on('scrollBarsHandler', this.setScrollBarsHandler);
  }

  private setScrollBarsHandler = (scrollBarsHandler: ScrollBarsHandler) => {
    this.scrollBarsHandler = scrollBarsHandler;
  };

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
    events.off('scrollBarsHandler', this.setScrollBarsHandler);
    this.scrollBarsHandler = undefined;
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

    this.scrollBarsHandler?.update(pixiApp.viewport.dirty);
    debugTimeCheck('[Update] scrollbars');

    const contentDirty = content.update(pixiApp.viewport.position, pixiApp.viewport.scaled);

    if (pixiApp.viewport.dirty || contentDirty) {
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
