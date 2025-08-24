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

    if (pixiApp.copying) {
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
    let rendererDirty =
      content.gridLines.dirty ||
      content.headings.dirty ||
      content.boxCells.dirty ||
      content.multiplayerCursor.dirty ||
      content.uiCursor.dirty ||
      content.cellImages.dirty ||
      content.cellHighlights.isDirty() ||
      content.cellMoving.dirty ||
      content.validations.dirty ||
      content.copy.dirty ||
      content.singleCellOutlines.dirty;

    if (rendererDirty && debugFlag('debugShowWhyRendering')) {
      console.log(
        `dirty: ${[
          pixiApp.viewport.dirty && 'viewport',
          content.gridLines.dirty && 'gridLines',
          content.headings.dirty && 'headings',
          content.boxCells.dirty && 'boxCells',
          content.multiplayerCursor.dirty && 'multiplayerCursor',
          content.uiCursor.dirty && 'cursor',
          content.cellImages.dirty && 'cellImages',
          content.cellHighlights.isDirty() && 'cellHighlights',
          content.cellMoving.dirty && 'cellMoving',
          content.validations.dirty && 'validations',
          content.copy.dirty && 'copy',
          content.singleCellOutlines.dirty && 'singleCellOutlines',
        ]
          .filter(Boolean)
          .join(', ')}`
      );
    }

    debugTimeReset();
    content.gridLines.update();
    debugTimeCheck('[Update] gridLines');
    content.headings.update(pixiApp.viewport.dirty);
    debugTimeCheck('[Update] headings');
    content.boxCells.update();
    debugTimeCheck('[Update] boxCells');
    content.cellHighlights.update();
    debugTimeCheck('[Update] cellHighlights');
    content.multiplayerCursor.update(pixiApp.viewport.dirty);
    debugTimeCheck('[Update] multiplayerCursor');
    content.cellImages.update();
    debugTimeCheck('[Update] cellImages');
    content.cellMoving.update();
    debugTimeCheck('[Update] cellMoving');
    content.cellsSheets.update(pixiApp.viewport.dirty);
    debugTimeCheck('[Update] cellsSheets');
    content.uiCursor.update(pixiApp.viewport.dirty);
    debugTimeCheck('[Update] cursor');
    content.validations.update(pixiApp.viewport.dirty);
    debugTimeCheck('[Update] validations');
    content.background.update(pixiApp.viewport.dirty);
    debugTimeCheck('[Update] backgrounds');
    content.copy.update();
    debugTimeCheck('[Update] copy');
    this.scrollBarsHandler?.update(pixiApp.viewport.dirty);
    debugTimeCheck('[Update] scrollbars');
    content.singleCellOutlines.update(viewportChanged);
    debugTimeCheck('[Update] singleCellOutlines');

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
