import './pixiApp.css';

import { defaultEditorInteractionState } from '@/app/atoms/editorInteractionStateAtom';
import { events } from '@/app/events/events';
import {
  copyToClipboardEvent,
  cutToClipboardEvent,
  pasteFromClipboardEvent,
} from '@/app/grid/actions/clipboard/clipboard';
import { sheets } from '@/app/grid/controller/Sheets';
import { startupTimer } from '@/app/gridGL/helpers/startupTimer';
import { Pointer } from '@/app/gridGL/interaction/pointer/Pointer';
import { ensureVisible } from '@/app/gridGL/interaction/viewportHelper';
import { isBitmapFontLoaded } from '@/app/gridGL/loadAssets';
import { content } from '@/app/gridGL/pixiApp/Content';
import { MomentumScrollDetector } from '@/app/gridGL/pixiApp/MomentumScrollDetector';
import { pixiAppSettings } from '@/app/gridGL/pixiApp/PixiAppSettings';
import { Update } from '@/app/gridGL/pixiApp/Update';
import { urlParams } from '@/app/gridGL/pixiApp/urlParams/urlParams';
import { Viewport } from '@/app/gridGL/pixiApp/viewport/Viewport';
import { fileViewState } from '@/app/fileViewState/fileViewState';
import { isEmbed } from '@/app/helpers/isEmbed';
import type { JsCoordinate, Rect } from '@/app/quadratic-core-types';
import { multiplayer } from '@/app/web-workers/multiplayerWebWorker/multiplayer';
import { rectToRectangle } from '@/app/web-workers/quadraticCore/worker/rustConversions';
import { renderWebWorker } from '@/app/web-workers/renderWebWorker/renderWebWorker';
import { Container, Rectangle, Renderer } from 'pixi.js';

export class PixiApp {
  private parent?: HTMLDivElement;
  private update!: Update;

  // Used to track whether we're done with the first render (either before or
  // after init is called, depending on timing).
  private waitingForFirstRender?: Function;
  private alreadyRendered = false;

  canvas: HTMLCanvasElement;
  viewport: Viewport;
  pointer!: Pointer;

  renderer: Renderer;
  momentumDetector: MomentumScrollDetector;
  stage = new Container();

  loading = true;
  destroyed = false;

  initialized = false;

  constructor() {
    this.canvas = document.createElement('canvas');
    this.renderer = new Renderer({
      view: this.canvas,
      resolution: Math.max(2, window.devicePixelRatio),
      antialias: true,
      backgroundColor: 0xffffff,
    });
    this.viewport = new Viewport(this);
    this.momentumDetector = new MomentumScrollDetector();

    events.on('debugFlags', this.setViewportDirty);
  }

  init = (): Promise<void> => {
    startupTimer.start('pixiApp');
    return new Promise((resolve) => {
      // we cannot initialize pixi until the bitmap fonts are loaded
      if (!isBitmapFontLoaded()) {
        events.once('bitmapFontsLoaded', () => this.init().then(resolve));
        return;
      }
      if (!this.initialized) {
        this.initCanvas();
        this.rebuild();
        renderWebWorker.sendBitmapFonts();
        urlParams.init();
        this.waitingForFirstRender = resolve;
        if (this.alreadyRendered) {
          this.firstRenderComplete();
        }
        this.initialized = true;
      }
    });
  };

  // called after RenderText has no more updates to send
  firstRenderComplete = () => {
    if (this.waitingForFirstRender) {
      this.renderer.render(this.stage);
      this.waitingForFirstRender();
      this.waitingForFirstRender = undefined;
    } else {
      this.alreadyRendered = true;
    }
    startupTimer.end('pixiApp');
  };

  private initCanvas = () => {
    this.canvas.id = 'QuadraticCanvasID';
    this.canvas.className = 'pixi_canvas';
    this.canvas.tabIndex = 0;

    const observer = new ResizeObserver(this.resize);
    observer.observe(this.canvas);

    this.stage.addChild(this.viewport);

    this.reset();

    this.pointer = new Pointer(this.viewport);

    this.update = new Update();

    this.setupListeners();
  };

  private setupListeners = () => {
    window.addEventListener('resize', this.resize);
    document.addEventListener('copy', copyToClipboardEvent);
    document.addEventListener('paste', pasteFromClipboardEvent);
    document.addEventListener('cut', cutToClipboardEvent);
  };

  private removeListeners = () => {
    window.removeEventListener('resize', this.resize);
    document.removeEventListener('copy', copyToClipboardEvent);
    document.removeEventListener('paste', pasteFromClipboardEvent);
    document.removeEventListener('cut', cutToClipboardEvent);
  };

  // calculate sheet rectangle, without heading, factoring in scale
  getViewportRectangle = (): Rectangle => {
    const headingSize = content.headings.headingSize;
    const scale = this.viewport.scale.x;

    const viewportBounds = this.viewport.getVisibleBounds();
    const rectangle = new Rectangle(
      viewportBounds.left + headingSize.width / scale,
      viewportBounds.top + headingSize.height / scale,
      viewportBounds.width - headingSize.width / scale,
      viewportBounds.height - headingSize.height / scale
    );

    return rectangle;
  };

  setViewportDirty = (): void => {
    this.viewport.dirty = true;
  };

  viewportChanged = (): void => {
    this.viewport.dirty = true;
    events.emit('setDirty', { gridLines: true, headings: true, cursor: true, cellHighlights: true });
    content.cellsSheets.cull(this.viewport.getVisibleBounds());

    // we only set the viewport if update has completed firstRenderComplete
    // (otherwise we can't get this.headings.headingSize) -- this is a hack
    if (this.update.firstRenderComplete) {
      sheets.sheet.cursor.viewport = this.viewport.lastViewport!;
      multiplayer.sendViewport(this.saveMultiplayerViewport());
    }
  };

  attach = (parent: HTMLDivElement): void => {
    if (!this.canvas) return;

    this.parent = parent;
    this.canvas.classList.add('dark-mode-hack');
    parent.appendChild(this.canvas);
    this.resize();
    this.update.start();
    if (!isEmbed) {
      this.canvas.focus();
    }
    urlParams.show();

    // Apply saved viewport/selection from IndexedDB before first render so
    // the user never sees the default viewport flash.
    fileViewState.applyViewportState();

    this.setViewportDirty();
  };

  destroy = (): void => {
    this.update.destroy();
    this.renderer.destroy(true);
    this.viewport.destroy();
    this.removeListeners();
    this.destroyed = true;
  };

  resize = (): void => {
    if (!this.parent || this.destroyed) return;
    const width = this.parent.offsetWidth;
    const height = this.parent.offsetHeight;
    this.canvas.width = this.renderer.resolution * width;
    this.canvas.height = this.renderer.resolution * height;
    this.renderer.resize(width, height);
    this.viewport.resize(width, height);
    events.emit('setDirty', { gridLines: true, headings: true, cursor: true, cellHighlights: true });
    this.render();
  };

  private render(): void {
    this.viewport.addChild(content);
    this.renderer.render(this.stage);
  }

  focus(): void {
    this.canvas?.focus();
  }

  private reset(): void {
    this.viewport.scale.set(1);
    pixiAppSettings.setEditorInteractionState?.(defaultEditorInteractionState);
  }

  private rebuild = () => {
    this.viewport.dirty = true;
    events.emit('setDirty', {
      gridLines: true,
      headings: true,
      cursor: true,
      cellHighlights: true,
      multiplayerCursor: true,
    });
    content.boxCells.reset();
    this.reset();
    this.setViewportDirty();
  };

  saveMultiplayerViewport(): string {
    const viewport = this.viewport;
    return JSON.stringify({
      x: viewport.center.x,
      y: viewport.center.y,
      bounds: viewport.getVisibleBounds(),
      sheetId: sheets.current,
    });
  }

  updateCursorPosition(visible: boolean | JsCoordinate = true) {
    events.emit('setDirty', { cursor: true, cellHighlights: true, headings: true });

    if (visible) {
      ensureVisible(visible !== true ? visible : undefined);
    }

    events.emit('cursorPosition');
  }

  // called when the viewport is loaded from the URL
  urlViewportLoad(sheetId: string) {
    const cellsSheet = sheets.getById(sheetId);
    if (cellsSheet) {
      cellsSheet.cursor.viewport = {
        x: this.viewport.x,
        y: this.viewport.y,
        scaleX: this.viewport.scale.x,
        scaleY: this.viewport.scale.y,
      };
    }
  }

  getVisibleRect = (): Rect => {
    const { left, top, right, bottom } = this.viewport.getVisibleBounds();
    const scale = this.viewport.scale.x;
    let { width: leftHeadingWidth, height: topHeadingHeight } = content.headings.headingSize;
    leftHeadingWidth /= scale;
    topHeadingHeight /= scale;
    const top_left_cell = sheets.sheet.getColumnRow(left + 1 + leftHeadingWidth, top + 1 + topHeadingHeight);
    const bottom_right_cell = sheets.sheet.getColumnRow(right, bottom);
    return {
      min: { x: BigInt(top_left_cell.x), y: BigInt(top_left_cell.y) },
      max: { x: BigInt(bottom_right_cell.x), y: BigInt(bottom_right_cell.y) },
    };
  };

  getVisibleRectangle = (): Rectangle => {
    const visibleRect = this.getVisibleRect();
    return rectToRectangle(visibleRect);
  };
}

export const pixiApp = new PixiApp();
