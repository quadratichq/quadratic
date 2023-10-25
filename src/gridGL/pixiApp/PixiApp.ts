import { Viewport } from 'pixi-viewport';
import { Container, Graphics, Renderer } from 'pixi.js';
import { isMobile } from 'react-device-detect';
import { editorInteractionStateDefault } from '../../atoms/editorInteractionStateAtom';
import { HEADING_SIZE } from '../../constants/gridConstants';
import { debugShowCacheFlag } from '../../debugFlags';
import {
  copyToClipboardEvent,
  cutToClipboardEvent,
  pasteFromClipboardEvent,
} from '../../grid/actions/clipboard/clipboard';
import { sheets } from '../../grid/controller/Sheets';
import { AxesLines } from '../UI/AxesLines';
import { Cursor } from '../UI/Cursor';
import { GridLines } from '../UI/GridLines';
import { BoxCells } from '../UI/boxCells';
import { GridHeadings } from '../UI/gridHeadings/GridHeadings';
import { CellsSheets } from '../cells/CellsSheets';
import { Pointer } from '../interaction/pointer/Pointer';
import { ensureVisible } from '../interaction/viewportHelper';
import { loadAssets } from '../loadAssets';
import { HORIZONTAL_SCROLL_KEY, Wheel, ZOOM_KEY } from '../pixiOverride/Wheel';
import { Quadrants } from '../quadrants/Quadrants';
import { pixiAppSettings } from './PixiAppSettings';
import { Update } from './Update';
import './pixiApp.css';

export class PixiApp {
  private parent?: HTMLDivElement;
  private update!: Update;
  private cacheIsVisible = false;

  canvas!: HTMLCanvasElement;
  viewport!: Viewport;
  gridLines!: GridLines;
  axesLines!: AxesLines;
  cursor!: Cursor;
  headings!: GridHeadings;
  boxCells!: BoxCells;
  cellsSheets!: CellsSheets;
  quadrants!: Quadrants;
  pointer!: Pointer;
  viewportContents!: Container;
  renderer!: Renderer;
  stage = new Container();
  loading = true;
  destroyed = false;
  paused = true;

  // for testing purposes
  debug!: Graphics;

  async init() {
    await loadAssets();
    this.initCanvas();
    await this.rebuild();

    // keep a reference of app on window, used for Playwright tests
    //@ts-expect-error
    window.pixiapp = this;

    console.log('[QuadraticGL] environment ready');
  }

  private initCanvas() {
    this.canvas = document.createElement('canvas');
    this.canvas.id = 'QuadraticCanvasID';
    this.canvas.className = 'pixi_canvas';
    this.canvas.tabIndex = 0;

    const resolution = Math.max(2, window.devicePixelRatio);
    this.renderer = new Renderer({
      view: this.canvas,
      resolution,
      antialias: true,
      backgroundColor: 0xffffff,
    });

    this.viewport = new Viewport({ interaction: this.renderer.plugins.interaction });
    this.stage.addChild(this.viewport);
    this.viewport
      .drag({
        pressDrag: true,
        wheel: false, // handled by Wheel plugin below
        ...(isMobile ? {} : { keyToPress: ['Space'] }),
      })
      .decelerate()
      .pinch()
      .clampZoom({
        minScale: 0.01,
        maxScale: 10,
      });
    this.viewport.plugins.add(
      'wheel',
      new Wheel(this.viewport, {
        trackpadPinch: true,
        wheelZoom: true,
        percent: 1.5,
        keyToPress: [...ZOOM_KEY, ...HORIZONTAL_SCROLL_KEY],
      })
    );

    // hack to ensure pointermove works outside of canvas
    this.viewport.off('pointerout');

    // this holds the viewport's contents so it can be reused in Quadrants
    this.viewportContents = this.viewport.addChild(new Container());

    // useful for debugging at viewport locations
    this.debug = this.viewportContents.addChild(new Graphics());

    // todo...
    this.quadrants = new Quadrants(); //this.viewportContents.addChild(new Quadrants(this));
    this.quadrants.visible = false;

    this.gridLines = this.viewportContents.addChild(new GridLines());
    this.axesLines = this.viewportContents.addChild(new AxesLines());
    this.cellsSheets = this.viewportContents.addChild(new CellsSheets());

    this.boxCells = this.viewportContents.addChild(new BoxCells());
    this.cursor = this.viewportContents.addChild(new Cursor());
    this.headings = this.viewportContents.addChild(new GridHeadings());

    this.reset();

    this.pointer = new Pointer(this.viewport);
    this.update = new Update();

    // if (debugAlwaysShowCache) this.showCache();
    // console.log('listeners...');
    this.setupListeners();
  }

  private setupListeners() {
    window.addEventListener('resize', this.resize);
    document.addEventListener('copy', copyToClipboardEvent);
    document.addEventListener('paste', pasteFromClipboardEvent);
    document.addEventListener('cut', cutToClipboardEvent);
  }

  private removeListeners() {
    window.removeEventListener('resize', this.resize);
    document.removeEventListener('copy', copyToClipboardEvent);
    document.removeEventListener('paste', pasteFromClipboardEvent);
    document.removeEventListener('cut', cutToClipboardEvent);
  }

  private showCache(): void {
    if (debugShowCacheFlag && !this.quadrants.visible) {
      const cacheOn = document.querySelector('.debug-show-cache-on');
      if (cacheOn) {
        (cacheOn as HTMLSpanElement).innerHTML = 'CACHE';
      }
    }
    // this.cells.changeVisibility(false);
    this.quadrants.visible = true;
    this.cacheIsVisible = true;
  }

  private showCells(): void {
    // if (debugShowCacheFlag && !this.cells.visible) {
    //   const cacheOn = document.querySelector('.debug-show-cache-on') as HTMLSpanElement;
    //   if (cacheOn) {
    //     cacheOn.innerHTML = '';
    //   }
    // }
    // this.cells.dirty = true;
    // this.cells.changeVisibility(true);
    this.quadrants.visible = false;
    this.cacheIsVisible = false;
  }

  setViewportDirty(): void {
    this.viewport.dirty = true;
  }

  viewportChanged = (): void => {
    this.viewport.dirty = true;
    this.gridLines.dirty = true;
    this.axesLines.dirty = true;
    this.headings.dirty = true;
    this.cursor.dirty = true;
    this.cellsSheets?.cull(this.viewport.getVisibleBounds());
    sheets.sheet.cursor.viewport = this.viewport.lastViewport!;

    // if (!debugNeverShowCache && (this.viewport.scale.x < QUADRANT_SCALE || debugAlwaysShowCache)) {
    //   this.showCache();
    // } else {
    //   this.showCells();
    // }
  };

  attach(parent: HTMLDivElement): void {
    this.parent = parent;
    parent.appendChild(this.canvas);
    this.resize();
    this.update.start();
    this.canvas.focus();
  }

  destroy(): void {
    this.update.destroy();
    this.renderer.destroy(true);
    this.viewport.destroy();
    this.quadrants.destroy();
    this.removeListeners();
    this.destroyed = true;
  }

  resize = (): void => {
    if (!this.parent || this.destroyed) return;
    const width = this.parent.offsetWidth;
    const height = this.parent.offsetHeight;
    this.canvas.width = this.renderer.resolution * width;
    this.canvas.height = this.renderer.resolution * height;
    this.renderer.resize(width, height);
    this.viewport.resize(width, height);
    this.gridLines.dirty = true;
    this.axesLines.dirty = true;
    this.headings.dirty = true;
    this.cursor.dirty = true;
  };

  // called before and after a quadrant render
  prepareForCopying(options?: { gridLines: boolean }): Container {
    this.gridLines.visible = options?.gridLines ?? false;
    this.axesLines.visible = false;
    this.cursor.visible = false;
    this.headings.visible = false;
    this.quadrants.visible = false;
    this.boxCells.visible = false;
    return this.viewportContents;
  }

  cleanUpAfterCopying(): void {
    this.gridLines.visible = true;
    this.axesLines.visible = true;
    this.cursor.visible = true;
    this.headings.visible = true;
    this.boxCells.visible = true;
    this.quadrants.visible = this.cacheIsVisible;
  }

  // helper for playwright
  render(): void {
    this.renderer.render(this.stage);
  }

  focus(): void {
    this.canvas?.focus();
  }

  reset(): void {
    this.viewport.scale.set(1);
    if (pixiAppSettings.showHeadings) {
      this.viewport.position.set(HEADING_SIZE, HEADING_SIZE);
    } else {
      this.viewport.position.set(0, 0);
    }
    pixiAppSettings.setEditorInteractionState?.(editorInteractionStateDefault);
  }

  // Pre-renders quadrants by cycling through one quadrant per frame
  preRenderQuadrants(resolve?: () => void): Promise<void> {
    return new Promise((_resolve) => {
      if (!resolve) {
        resolve = _resolve;
      }
      this.quadrants.update(0);
      if (this.quadrants.needsUpdating()) {
        // the timeout allows the quadratic logo animation to appear smooth
        setTimeout(() => this.preRenderQuadrants(resolve), 100);
      } else {
        resolve();
      }
    });
  }

  async rebuild() {
    sheets.create();
    await this.cellsSheets.create();

    this.paused = true;
    this.viewport.dirty = true;
    this.gridLines.dirty = true;
    this.axesLines.dirty = true;
    this.headings.dirty = true;
    this.cursor.dirty = true;
    this.boxCells.reset();

    this.viewport.dirty = true;
    this.paused = false;
    this.reset();
  }

  loadViewport(): void {
    const lastViewport = sheets.sheet.cursor.viewport;
    if (lastViewport) {
      this.viewport.position.set(lastViewport.x, lastViewport.y);
      this.viewport.scale.set(lastViewport.scaleX, lastViewport.scaleY);
      this.viewport.dirty = true;
    }
  }

  getStartingViewport(): { x: number; y: number } {
    if (pixiAppSettings.showHeadings) {
      return { x: HEADING_SIZE, y: HEADING_SIZE };
    } else {
      return { x: 0, y: 0 };
    }
  }

  updateCursorPosition(
    options = {
      ensureVisible: true,
    }
  ): void {
    this.cursor.dirty = true;
    this.headings.dirty = true;

    if (options.ensureVisible) ensureVisible();

    // triggers useGetBorderMenu clearSelection()
    window.dispatchEvent(new CustomEvent('cursor-position'));
  }

  adjustHeadings(options: { sheetId: string; delta: number; row?: number; column?: number }): void {
    this.cellsSheets.adjustHeadings(options);
    this.headings.dirty = true;
    this.gridLines.dirty = true;
    this.cursor.dirty = true;
  }
}

export const pixiApp = new PixiApp();
