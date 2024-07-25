import { events } from '@/app/events/events';
import { UICellImages } from '@/app/gridGL/UI/UICellImages';
import { UICellMoving } from '@/app/gridGL/UI/UICellMoving';
import { CellHighlights } from '@/app/gridGL/UI/cellHighlights/CellHighlights';
import { CellsImages } from '@/app/gridGL/cells/cellsImages/CellsImages';
import { ensureVisible } from '@/app/gridGL/interaction/viewportHelper';
import { Coordinate } from '@/app/gridGL/types/size';
import { isEmbed } from '@/app/helpers/isEmbed';
import { multiplayer } from '@/app/web-workers/multiplayerWebWorker/multiplayer';
import { renderWebWorker } from '@/app/web-workers/renderWebWorker/renderWebWorker';
import { HEADING_SIZE } from '@/shared/constants/gridConstants';
import { Container, Graphics, Rectangle, Renderer, utils } from 'pixi.js';
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
import { pixiAppSettings } from './PixiAppSettings';
import { Update } from './Update';
import { Viewport } from './Viewport';
import './pixiApp.css';
import { urlParams } from './urlParams/urlParams';

utils.skipHello();

export class PixiApp {
  private parent?: HTMLDivElement;
  private update!: Update;

  // Used to track whether we're done with the first render (either before or
  // after init is called, depending on timing).
  private waitingForFirstRender?: Function;
  private alreadyRendered = false;

  // todo: UI should be pulled out and separated into its own class

  canvas!: HTMLCanvasElement;
  viewport!: Viewport;
  gridLines!: GridLines;
  axesLines!: AxesLines;
  cursor!: Cursor;
  cellHighlights!: CellHighlights;
  multiplayerCursor!: UIMultiPlayerCursor;
  cellMoving!: UICellMoving;
  headings!: GridHeadings;
  boxCells!: BoxCells;
  cellsSheets: CellsSheets;
  pointer!: Pointer;
  viewportContents!: Container;
  htmlPlaceholders!: HtmlPlaceholders;
  imagePlaceholders!: Container;
  cellImages!: UICellImages;
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
    this.cellImages = new UICellImages();
    this.viewport = new Viewport();
  }

  init() {
    this.initialized = true;
    this.initCanvas();
    this.rebuild();

    urlParams.init();

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

    const observer = new ResizeObserver(this.resize);
    observer.observe(this.canvas);

    const resolution = Math.max(2, window.devicePixelRatio);
    this.renderer = new Renderer({
      view: this.canvas,
      resolution,
      antialias: true,
      backgroundColor: 0xffffff,
    });
    this.viewport.options.interaction = this.renderer.plugins.interaction;
    this.stage.addChild(this.viewport);

    // this holds the viewport's contents
    this.viewportContents = this.viewport.addChild(new Container());

    // useful for debugging at viewport locations
    this.debug = this.viewportContents.addChild(new Graphics());

    this.cellsSheets = this.viewportContents.addChild(this.cellsSheets);
    this.gridLines = this.viewportContents.addChild(new GridLines());
    this.axesLines = this.viewportContents.addChild(new AxesLines());
    this.boxCells = this.viewportContents.addChild(new BoxCells());
    this.cellImages = this.viewportContents.addChild(this.cellImages);
    this.multiplayerCursor = this.viewportContents.addChild(new UIMultiPlayerCursor());
    this.cursor = this.viewportContents.addChild(new Cursor());
    this.htmlPlaceholders = this.viewportContents.addChild(new HtmlPlaceholders());
    this.imagePlaceholders = this.viewportContents.addChild(new Container());
    this.cellHighlights = this.viewportContents.addChild(new CellHighlights());
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
    this.cellHighlights.dirty = true;
    this.cellsSheets?.cull(this.viewport.getVisibleBounds());
    sheets.sheet.cursor.viewport = this.viewport.lastViewport!;
    multiplayer.sendViewport(this.saveMultiplayerViewport());
  };

  attach(parent: HTMLDivElement): void {
    if (!this.canvas) return;

    this.parent = parent;
    parent.appendChild(this.canvas);
    this.resize();
    this.update.start();
    if (!isEmbed) {
      this.canvas.focus();
    }
    urlParams.show();
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
    this.cellHighlights.dirty = true;
    this.render();
  };

  // called before and after a render
  prepareForCopying(options?: { gridLines?: boolean; cull?: Rectangle }): Container {
    this.gridLines.visible = options?.gridLines ?? false;
    this.axesLines.visible = false;
    this.cursor.visible = false;
    this.cellHighlights.visible = false;
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
    this.cellHighlights.visible = true;
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
    this.cellHighlights.dirty = true;
    this.multiplayerCursor.dirty = true;
    this.boxCells.reset();
    this.paused = false;
    this.reset();
    this.setViewportDirty();
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

  updateCursorPosition(visible: boolean | Coordinate = true) {
    this.cursor.dirty = true;
    this.cellHighlights.dirty = true;
    this.headings.dirty = true;
    if (!pixiAppSettings.showCellTypeOutlines) {
      this.cellsSheets.updateCellsArray();
    }
    if (visible) ensureVisible(visible !== true ? visible : undefined);
    events.emit('cursorPosition');
  }

  adjustHeadings(options: { sheetId: string; delta: number; row?: number; column?: number }): void {
    this.cellsSheets.adjustHeadings(options);
    this.cellsSheets.adjustOffsetsBorders(options.sheetId);
    htmlCellsHandler.updateOffsets([sheets.sheet.id]);
    if (sheets.sheet.id === options.sheetId) {
      this.gridLines.dirty = true;
      this.cursor.dirty = true;
      this.cellHighlights.dirty = true;
      this.headings.dirty = true;
      this.multiplayerCursor.dirty = true;
    }
  }

  // this shows the CellImages of the current sheet, removing any old ones. This
  // is needed to ensure the proper z-index for the images (ie, so it shows over
  // the grid lines).
  changeCellImages(cellsImages: CellsImages) {
    this.imagePlaceholders.removeChildren();
    this.imagePlaceholders.addChild(cellsImages);
  }

  isCursorOnCodeCell(): boolean {
    return this.cellsSheets.isCursorOnCodeCell();
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
}

export const pixiApp = new PixiApp();
