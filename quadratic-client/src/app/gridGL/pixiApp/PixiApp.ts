import { events } from '@/app/events/events';
import { UICellMoving } from '@/app/gridGL/UI/UICellMoving';
import { isEmbed } from '@/app/helpers/isEmbed';
import { multiplayer } from '@/app/web-workers/multiplayerWebWorker/multiplayer';
import { renderWebWorker } from '@/app/web-workers/renderWebWorker/renderWebWorker';
import { HEADING_SIZE } from '@/shared/constants/gridConstants';
import { Drag, Viewport } from 'pixi-viewport';
import { Container, Graphics, Point, Rectangle, Renderer, utils } from 'pixi.js';
import { isMobile } from 'react-device-detect';
import { editorInteractionStateDefault } from '../../atoms/editorInteractionStateAtom';
import {
  copyToClipboardEvent,
  cutToClipboardEvent,
  pasteFromClipboardEvent,
} from '../../grid/actions/clipboard/clipboard';
import { sheets } from '../../grid/controller/Sheets';
import { htmlCellsHandler } from '../HTMLGrid/htmlCells/htmlCellsHandler';
import { AxesLines } from '../UI/AxesLines';
import { Cursor } from '../UI/Cursor';
import { GridLines } from '../UI/GridLines';
import { HtmlPlaceholders } from '../UI/HtmlPlaceholders';
import { UIMultiPlayerCursor } from '../UI/UIMultiplayerCursor';
import { BoxCells } from '../UI/boxCells';
import { GridHeadings } from '../UI/gridHeadings/GridHeadings';
import { CellsSheets } from '../cells/CellsSheets';
import { Pointer } from '../interaction/pointer/Pointer';
import { ensureVisible } from '../interaction/viewportHelper';
import { HORIZONTAL_SCROLL_KEY, Wheel, ZOOM_KEY } from '../pixiOverride/Wheel';
import { pixiAppSettings } from './PixiAppSettings';
import { Update } from './Update';
import { HighlightedCells } from './highlightedCells';
import './pixiApp.css';

// todo: move viewport stuff to a viewport.ts file
const MULTIPLAYER_VIEWPORT_EASE_TIME = 100;

utils.skipHello();

export class PixiApp {
  private parent?: HTMLDivElement;
  private update!: Update;

  // Used to track whether we're done with the first render (either before or
  // after init is called, depending on timing).
  private waitingForFirstRender?: Function;
  private alreadyRendered = false;

  // todo: UI should be pulled out and separated into its own class

  highlightedCells = new HighlightedCells();
  canvas!: HTMLCanvasElement;
  viewport!: Viewport;
  gridLines!: GridLines;
  axesLines!: AxesLines;
  cursor!: Cursor;
  multiplayerCursor!: UIMultiPlayerCursor;
  cellMoving!: UICellMoving;
  headings!: GridHeadings;
  boxCells!: BoxCells;
  cellsSheets: CellsSheets;
  pointer!: Pointer;
  viewportContents!: Container;
  htmlPlaceholders!: HtmlPlaceholders;
  renderer!: Renderer;
  stage = new Container();
  loading = true;
  destroyed = false;
  paused = true;

  // for testing purposes
  debug!: Graphics;

  // used for timing purposes for sheets initialized after first render
  sheetsCreated = false;

  initialized = false;

  constructor() {
    // This is created first so it can listen to messages from QuadraticCore.
    this.cellsSheets = new CellsSheets();
    this.viewport = new Viewport();
  }

  init() {
    this.initialized = true;
    this.initCanvas();
    this.rebuild();
    if (this.sheetsCreated) {
      renderWebWorker.pixiIsReady(sheets.current, this.viewport.getVisibleBounds());
    }
    return new Promise((resolve) => {
      this.waitingForFirstRender = resolve;
      if (this.alreadyRendered) {
        this.firstRenderComplete();
      }
    });
  }

  // called after RenderText has no more updates to send
  firstRenderComplete() {
    if (this.waitingForFirstRender) {
      // perform a render to warm up the GPU
      this.cellsSheets.showAll(sheets.sheet.id);
      pixiApp.renderer.render(pixiApp.stage);
      this.waitingForFirstRender();
      this.waitingForFirstRender = undefined;
    } else {
      this.alreadyRendered = true;
    }
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
    this.viewport.options.interaction = this.renderer.plugins.interaction;
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
    if (!isMobile) {
      this.viewport.plugins.add(
        'drag-middle-mouse',
        new Drag(this.viewport, {
          pressToDrag: true,
          mouseButtons: 'middle',
          wheel: 'false',
        })
      );
    }

    this.viewport.on('moved', () => {});

    // hack to ensure pointermove works outside of canvas
    this.viewport.off('pointerout');

    // this holds the viewport's contents
    this.viewportContents = this.viewport.addChild(new Container());

    // useful for debugging at viewport locations
    this.debug = this.viewportContents.addChild(new Graphics());

    this.cellsSheets = this.viewportContents.addChild(this.cellsSheets);
    this.gridLines = this.viewportContents.addChild(new GridLines());
    this.axesLines = this.viewportContents.addChild(new AxesLines());
    this.htmlPlaceholders = this.viewportContents.addChild(new HtmlPlaceholders());
    this.boxCells = this.viewportContents.addChild(new BoxCells());
    this.multiplayerCursor = this.viewportContents.addChild(new UIMultiPlayerCursor());
    this.cursor = this.viewportContents.addChild(new Cursor());
    this.cellMoving = this.viewportContents.addChild(new UICellMoving());
    this.headings = this.viewportContents.addChild(new GridHeadings());

    this.reset();

    this.pointer = new Pointer(this.viewport);
    this.update = new Update();

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
    multiplayer.sendViewport(this.saveMultiplayerViewport());
  };

  attach(parent: HTMLDivElement): void {
    this.parent = parent;
    parent.appendChild(this.canvas);
    this.resize();
    this.update.start();
    if (!isEmbed) {
      this.canvas.focus();
    }
    this.setViewportDirty();
  }

  destroy(): void {
    this.update.destroy();
    this.renderer.destroy(true);
    this.viewport.destroy();
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

  // called before and after a render
  prepareForCopying(options?: { gridLines?: boolean; cull?: Rectangle }): Container {
    this.gridLines.visible = options?.gridLines ?? false;
    this.axesLines.visible = false;
    this.cursor.visible = false;
    this.multiplayerCursor.visible = false;
    this.headings.visible = false;
    this.boxCells.visible = false;
    this.htmlPlaceholders.prepare();
    this.cellsSheets.toggleOutlines(false);
    if (options?.cull) {
      this.cellsSheets.cull(options.cull);
    }
    return this.viewportContents;
  }

  cleanUpAfterCopying(culled?: boolean): void {
    this.gridLines.visible = true;
    this.axesLines.visible = true;
    this.cursor.visible = true;
    this.multiplayerCursor.visible = true;
    this.headings.visible = true;
    this.boxCells.visible = true;
    this.htmlPlaceholders.hide();
    this.cellsSheets.toggleOutlines();
    if (culled) {
      this.cellsSheets.cull(this.viewport.getVisibleBounds());
    }
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

  rebuild() {
    this.paused = true;
    this.viewport.dirty = true;
    this.gridLines.dirty = true;
    this.axesLines.dirty = true;
    this.headings.dirty = true;
    this.cursor.dirty = true;
    this.multiplayerCursor.dirty = true;
    this.boxCells.reset();
    this.paused = false;
    this.reset();
    this.setViewportDirty();
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

  saveMultiplayerViewport(): string {
    const viewport = this.viewport;
    return JSON.stringify({
      x: viewport.center.x,
      y: viewport.center.y,
      bounds: viewport.getVisibleBounds(),
      sheetId: sheets.sheet.id,
    });
  }

  loadMultiplayerViewport(options: { x: number; y: number; bounds: Rectangle; sheetId: string }): void {
    const { x, y, bounds } = options;
    let width: number | undefined;
    let height: number | undefined;

    // ensure the entire follow-ee's bounds is visible to the current user
    if (this.viewport.screenWidth / this.viewport.screenHeight > bounds.width / bounds.height) {
      height = bounds.height;
    } else {
      width = bounds.width;
    }
    if (sheets.current !== options.sheetId) {
      sheets.current = options.sheetId;
      this.viewport.moveCenter(new Point(x, y));
    } else {
      this.viewport.animate({
        position: new Point(x, y),
        width,
        height,
        removeOnInterrupt: true,
        time: MULTIPLAYER_VIEWPORT_EASE_TIME,
      });
    }
    this.viewport.dirty = true;
  }

  updateCursorPosition(
    options = {
      ensureVisible: true,
    }
  ): void {
    this.cursor.dirty = true;
    this.headings.dirty = true;
    if (!pixiAppSettings.showCellTypeOutlines) {
      this.cellsSheets.updateCellsArray();
    }
    if (options.ensureVisible) ensureVisible();

    // triggers useGetBorderMenu clearSelection()
    events.emit('cursorPosition');
  }

  adjustHeadings(options: { sheetId: string; delta: number; row?: number; column?: number }): void {
    this.cellsSheets.adjustHeadings(options);
    this.cellsSheets.adjustOffsetsBorders(options.sheetId);
    htmlCellsHandler.updateOffsets([sheets.sheet.id]);
    if (sheets.sheet.id === options.sheetId) {
      pixiApp.gridLines.dirty = true;
      pixiApp.cursor.dirty = true;
      pixiApp.headings.dirty = true;
      this.multiplayerCursor.dirty = true;
    }
  }
}

export const pixiApp = new PixiApp();
