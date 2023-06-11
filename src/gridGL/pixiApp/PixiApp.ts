import { Renderer, Container, Graphics } from 'pixi.js';
import { Viewport } from 'pixi-viewport';
import { PixiAppSettings } from './PixiAppSettings';
import { Pointer } from '../interaction/pointer/Pointer';
import { Update } from './Update';
import './pixiApp.css';
import { GridLines } from '../UI/GridLines';
import { AxesLines } from '../UI/AxesLines';
import { GridHeadings } from '../UI/gridHeadings/GridHeadings';
import { Cursor } from '../UI/Cursor';
import { Cells } from '../UI/cells/Cells';
import { zoomInOut, zoomToFit, zoomToSelection } from '../helpers/zoom';
import { Quadrants } from '../quadrants/Quadrants';
import { QUADRANT_SCALE } from '../quadrants/quadrantConstants';
import { debugAlwaysShowCache, debugNeverShowCache, debugShowCacheFlag } from '../../debugFlags';
import { Sheet } from '../../grid/sheet/Sheet';
import { SheetController } from '../../grid/controller/sheetController';
import { HEADING_SIZE } from '../../constants/gridConstants';
import { editorInteractionStateDefault } from '../../atoms/editorInteractionStateAtom';
import { gridInteractionStateDefault } from '../../atoms/gridInteractionStateAtom';
import { IS_READONLY_MODE } from '../../constants/app';
import { Wheel, ZOOM_KEY, HORIZONTAL_SCROLL_KEY } from '../pixiOverride/Wheel';
import { BoxCells } from '../UI/boxCells';

export class PixiApp {
  private parent?: HTMLDivElement;
  private update: Update;
  private cacheIsVisible = false;
  save: () => Promise<void>;

  sheet_controller: SheetController;

  canvas: HTMLCanvasElement;
  viewport: Viewport;
  gridLines: GridLines;
  axesLines: AxesLines;
  cursor: Cursor;
  headings: GridHeadings;
  boxCells: BoxCells;
  cells: Cells;

  quadrants: Quadrants;

  pointer: Pointer;
  viewportContents: Container;
  settings: PixiAppSettings;
  renderer: Renderer;
  stage = new Container();
  loading = true;
  destroyed = false;

  // for testing purposes
  debug: Graphics;

  constructor(sheet_controller: SheetController, save: () => Promise<void>) {
    this.sheet_controller = sheet_controller;
    this.save = save;
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
      .drag({
        pressDrag: true,
        wheel: false, // handled by Wheel plugin below
        ...(IS_READONLY_MODE ? {} : { keyToPress: ['Space'] }),
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

    this.quadrants = this.viewportContents.addChild(new Quadrants(this));
    this.quadrants.visible = false;

    this.gridLines = this.viewportContents.addChild(new GridLines(this));
    this.axesLines = this.viewportContents.addChild(new AxesLines(this));
    this.cells = this.viewportContents.addChild(new Cells(this));

    // ensure the cell's background color is drawn first
    this.viewportContents.addChildAt(this.cells.cellsBackground, 0);

    this.boxCells = this.viewportContents.addChild(new BoxCells(this));
    this.cursor = this.viewportContents.addChild(new Cursor(this));
    this.headings = this.viewportContents.addChild(new GridHeadings(this));

    this.settings = new PixiAppSettings(this);

    this.reset();

    this.pointer = new Pointer(this);
    this.update = new Update(this);

    if (debugAlwaysShowCache) this.showCache();

    window.addEventListener('resize', this.resize);

    this.rebuild();

    console.log('[QuadraticGL] environment ready');
  }

  get sheet(): Sheet {
    return this.sheet_controller.sheet;
  }

  private showCache(): void {
    if (debugShowCacheFlag && !this.quadrants.visible) {
      const cacheOn = document.querySelector('.debug-show-cache-on');
      if (cacheOn) {
        (cacheOn as HTMLSpanElement).innerHTML = 'CACHE';
      }
    }
    this.cells.changeVisibility(false);
    this.quadrants.visible = true;
    this.cacheIsVisible = true;
  }

  private showCells(): void {
    if (debugShowCacheFlag && !this.cells.visible) {
      const cacheOn = document.querySelector('.debug-show-cache-on') as HTMLSpanElement;
      if (cacheOn) {
        cacheOn.innerHTML = '';
      }
    }
    this.cells.dirty = true;
    this.cells.changeVisibility(true);
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
    if (!debugNeverShowCache && (this.viewport.scale.x < QUADRANT_SCALE || debugAlwaysShowCache)) {
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
    this.cells.dirty = true;
  };

  setZoomState(value: number): void {
    zoomInOut(this.viewport, value);
  }

  setZoomToFit(): void {
    zoomToFit(this.sheet, this.viewport);
  }

  setZoomToSelection(): void {
    zoomToSelection(this.settings.interactionState, this.sheet, this.viewport);
  }

  // called before and after a quadrant render
  prepareForQuadrantRendering(options?: { gridLines: boolean }): Container {
    this.gridLines.visible = options?.gridLines ?? false;
    this.axesLines.visible = false;
    this.cursor.visible = false;
    this.headings.visible = false;
    this.quadrants.visible = false;
    this.boxCells.visible = false;
    this.cells.changeVisibility(true);
    this.cells.dirty = true;
    return this.viewportContents;
  }

  cleanUpAfterQuadrantRendering(): void {
    this.gridLines.visible = true;
    this.axesLines.visible = true;
    this.cursor.visible = true;
    this.headings.visible = true;
    this.boxCells.visible = true;
    this.quadrants.visible = this.cacheIsVisible;
    this.cells.changeVisibility(!this.cacheIsVisible);
    if (!this.cacheIsVisible) this.cells.dirty = true;
  }

  // helper for playwright
  render(): void {
    this.renderer.render(this.stage);
  }

  focus(): void {
    this.canvas?.focus();
  }

  changeSheet(): void {
    this.viewport.dirty = true;
    this.gridLines.dirty = true;
    this.axesLines.dirty = true;
    this.headings.dirty = true;
    this.cursor.dirty = true;
    this.cells.dirty = true;
    this.quadrants.changeSheet();
    this.boxCells.reset();
    window.dispatchEvent(new CustomEvent('sheet-change'));
  }

  rebuild = (): void => {
    this.viewport.dirty = true;
    this.gridLines.dirty = true;
    this.axesLines.dirty = true;
    this.headings.dirty = true;
    this.cursor.dirty = true;
    this.cells.dirty = true;
    this.boxCells.reset();
    this.quadrants.build();
  };

  reset(): void {
    this.viewport.scale.set(1);
    if (this.settings.showHeadings) {
      this.viewport.position.set(HEADING_SIZE, HEADING_SIZE);
    } else {
      this.viewport.position.set(0, 0);
    }
    this.settings.setEditorInteractionState?.(editorInteractionStateDefault);
    this.settings.setInteractionState?.(gridInteractionStateDefault);
  }
}
