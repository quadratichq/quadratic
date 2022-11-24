import { Renderer, Container, Graphics } from 'pixi.js';
import { Viewport } from 'pixi-viewport';
import { isMobileOnly } from 'react-device-detect';
import { PixiAppSettings } from './PixiAppSettings';
import { Pointer } from '../interaction/pointer/Pointer';
import { Update } from './Update';
import './pixiApp.css';
import { GridOffsets } from '../../gridDB/GridOffsets';
import { GridLines } from '../UI/GridLines';
import { AxesLines } from '../UI/AxesLines';
import { GridHeadings } from '../UI/gridHeadings/GridHeadings';
import { Cursor } from '../UI/Cursor';
import { Cells } from '../UI/cells/Cells';
import { GridSparse } from '../../gridDB/GridSparse';
import { zoomInOut, zoomToFit } from '../helpers/zoom';
import { Quadrants } from '../quadrants/Quadrants';
import { QUADRANT_SCALE } from '../quadrants/quadrantConstants';
import { debugAlwaysShowCache, debugShowCacheOn } from '../../../debugFlags';

export class PixiApp {
  private parent?: HTMLDivElement;
  private update: Update;

  canvas: HTMLCanvasElement;
  gridLines: GridLines;
  axesLines: AxesLines;
  cursor: Cursor;
  headings: GridHeadings;
  cells: Cells;
  quadrants: Quadrants;

  input: Pointer;
  viewport: Viewport;
  gridOffsets: GridOffsets;
  grid: GridSparse;
  settings: PixiAppSettings;
  renderer: Renderer;
  stage = new Container();
  destroyed = false;

  // for testing purposes
  debug: Graphics;

  constructor() {
    this.gridOffsets = new GridOffsets(this);
    this.grid = new GridSparse(this);

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

    // keep a reference of app on window, used for Playwright tests

    //@ts-expect-error
    window.pixiapp = this;

    this.viewport = new Viewport({ interaction: this.renderer.plugins.interaction });
    this.stage.addChild(this.viewport);
    this.viewport
      .drag({ pressDrag: isMobileOnly }) // enable drag on mobile, no where else
      .decelerate()
      .pinch()
      .wheel({ trackpadPinch: true, wheelZoom: false, percent: 1.5 })
      .clampZoom({
        minScale: 0.01,
        maxScale: 10,
    });

    this.gridLines = this.viewport.addChild(new GridLines(this));
    this.axesLines = this.viewport.addChild(new AxesLines(this));
    this.cells = this.viewport.addChild(new Cells(this));
    // ensure the cell's background color is drawn first
    this.viewport.addChildAt(this.cells.cellsBackground, 0);

    this.quadrants = this.viewport.addChild(new Quadrants(this));
    this.quadrants.visible = false;

    this.cursor = this.viewport.addChild(new Cursor(this));
    this.headings = this.viewport.addChild(new GridHeadings(this));

    this.debug = this.viewport.addChild(new Graphics());

    this.settings = new PixiAppSettings(this);

    if (this.settings.showHeadings) this.viewport.position.set(20, 20);

    this.viewport.on('zoomed', () => {
      this.viewportChanged();
      this.settings.setZoomState && this.settings.setZoomState(this.viewport.scale.x);
    });
    this.viewport.on('moved', this.viewportChanged);

    this.input = new Pointer(this);
    this.update = new Update(this);

    if (debugAlwaysShowCache) this.showCache();

    window.addEventListener('resize', this.resize);

    console.log('[QuadraticGL] environment ready');
  }

  private showCache(): void {
    if (debugShowCacheOn && !this.quadrants.visible) {
      (document.querySelector('.debug-show-cache-on') as HTMLSpanElement).innerHTML = 'CACHE';
    }
    this.cells.visible = false;
    this.quadrants.visible = true;
  }

  private showCells(): void {
    if (debugShowCacheOn && !this.cells.visible) {
      (document.querySelector('.debug-show-cache-on') as HTMLSpanElement).innerHTML = '';
    }
    this.cells.visible = true;
    this.quadrants.visible = false;
  }

  viewportChanged = (): void => {
    this.viewport.dirty = true;
    this.gridLines.dirty = true;
    this.axesLines.dirty = true;
    this.headings.dirty = true;
    if (this.viewport.scale.x < QUADRANT_SCALE || debugAlwaysShowCache) {
      this.showCache();
    } else {
      this.showCells();
    }
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
    this.destroyed = true;
  }

  private resize = (): void => {
    if (!this.parent || this.destroyed) return;
    const width = this.parent.offsetWidth;
    const height = this.parent.offsetHeight;
    this.canvas.width = this.renderer.resolution * width;
    this.canvas.height = this.renderer.resolution * height;
    this.renderer.resize(width, height);
    this.viewport.resize(width, height);
  };

  checkZoom(): void {
    const zoom = this.settings.zoomState;
    if (zoom === Infinity) {
      zoomToFit(this.viewport);
    } else if (zoom !== this.viewport.scale.x) {
      zoomInOut(this.viewport, zoom);
      this.viewportChanged();
    }
  }

  // helper for playwright
  render() {
    this.renderer.render(this.stage)
  }

  focus() {
    this.canvas?.focus();
  }
}
