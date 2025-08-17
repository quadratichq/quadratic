import { debugFlag } from '@/app/debugFlags/debugFlags';
import { events } from '@/app/events/events';
import type { BaseApp } from '@/app/gridGL/BaseApp';
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

  // private scrollBarsHandlers: Record<string, { handler: ScrollBarsHandler; baseApp: BaseApp }> = {};

  firstRenderComplete = false;

  constructor() {
    if (debugFlag('debugShowFPS')) {
      this.fps = new FPS();
    }
    // events.on('scrollBarsHandler', this.setScrollBarsHandler);
  }

  // private setScrollBarsHandler = (name: string, baseApp?: BaseApp, handler?: ScrollBarsHandler) => {
  //   if (!baseApp || !handler) {
  //     delete this.scrollBarsHandlers[name];
  //   } else {
  //     this.scrollBarsHandlers[name] = { baseApp, handler };
  //   }
  // };

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
    // this.scrollBarsHandlers = {};
    // events.off('scrollBarsHandler', this.setScrollBarsHandler);
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

  updateOnly(baseApp: BaseApp): boolean {
    const viewportChanged = baseApp.viewport.updateViewport();
    let rendererDirty =
      baseApp.gridLines.dirty ||
      baseApp.headings.dirty ||
      baseApp.boxCells?.dirty ||
      baseApp.multiplayerCursor?.dirty ||
      baseApp.cursor?.dirty ||
      baseApp.cellImages?.dirty ||
      baseApp.cellHighlights?.isDirty() ||
      baseApp.cellMoving?.dirty ||
      baseApp.validations?.dirty ||
      baseApp.copy?.dirty ||
      baseApp.singleCellOutlines?.dirty;

    if (rendererDirty && debugFlag('debugShowWhyRendering')) {
      console.log(
        `dirty: ${[
          baseApp.viewport.dirty && 'viewport',
          baseApp.gridLines.dirty && 'gridLines',
          baseApp.headings.dirty && 'headings',
          baseApp.boxCells?.dirty && 'boxCells',
          baseApp.multiplayerCursor?.dirty && 'multiplayerCursor',
          baseApp.cursor?.dirty && 'cursor',
          baseApp.cellImages?.dirty && 'cellImages',
          baseApp.cellHighlights?.isDirty() && 'cellHighlights',
          baseApp.cellMoving?.dirty && 'cellMoving',
          baseApp.validations?.dirty && 'validations',
          baseApp.copy?.dirty && 'copy',
          pixiApp.singleCellOutlines?.dirty && 'singleCellOutlines',
        ]
          .filter(Boolean)
          .join(', ')}`
      );
    }

    debugTimeReset();
    baseApp.gridLines.update();
    debugTimeCheck('[Update] gridLines');
    baseApp.headings.update(baseApp.viewport.dirty);
    debugTimeCheck('[Update] headings');
    baseApp.boxCells?.update();
    debugTimeCheck('[Update] boxCells');
    baseApp.cellHighlights?.update();
    debugTimeCheck('[Update] cellHighlights');
    baseApp.multiplayerCursor?.update(baseApp.viewport.dirty);
    debugTimeCheck('[Update] multiplayerCursor');
    baseApp.cellImages?.update();
    debugTimeCheck('[Update] cellImages');
    baseApp.cellMoving?.update();
    debugTimeCheck('[Update] cellMoving');
    baseApp.cellsSheets?.update(baseApp.viewport.dirty);
    debugTimeCheck('[Update] cellsSheets');
    baseApp.cursor?.update(baseApp.viewport.dirty);
    debugTimeCheck('[Update] cursor');
    baseApp.validations?.update(baseApp.viewport.dirty);
    debugTimeCheck('[Update] validations');
    baseApp.background?.update(baseApp.viewport.dirty);
    debugTimeCheck('[Update] backgrounds');
    baseApp.copy?.update();
    debugTimeCheck('[Update] copy');
    baseApp.singleCellOutlines?.update(viewportChanged);
    debugTimeCheck('[Update] singleCellOutlines');
    return !!rendererDirty;
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
