import './pixiApp.css';

import { defaultEditorInteractionState } from '@/app/atoms/editorInteractionStateAtom';
import { events } from '@/app/events/events';
import {
  copyToClipboardEvent,
  cutToClipboardEvent,
  pasteFromClipboardEvent,
} from '@/app/grid/actions/clipboard/clipboard';
import { sheets } from '@/app/grid/controller/Sheets';
import { htmlCellsHandler } from '@/app/gridGL/HTMLGrid/htmlCells/htmlCellsHandler';
import { Background } from '@/app/gridGL/UI/Background';
import { Cursor } from '@/app/gridGL/UI/Cursor';
import { GridLines } from '@/app/gridGL/UI/GridLines';
import { HtmlPlaceholders } from '@/app/gridGL/UI/HtmlPlaceholders';
import { UICellImages } from '@/app/gridGL/UI/UICellImages';
import { UICellMoving } from '@/app/gridGL/UI/UICellMoving';
import { UICopy } from '@/app/gridGL/UI/UICopy';
import { UIMultiPlayerCursor } from '@/app/gridGL/UI/UIMultiplayerCursor';
import { UISingleCellOutlines } from '@/app/gridGL/UI/UISingleCellOutlines';
import { UIValidations } from '@/app/gridGL/UI/UIValidations';
import { BoxCells } from '@/app/gridGL/UI/boxCells';
import { CellHighlights } from '@/app/gridGL/UI/cellHighlights/CellHighlights';
import { GridHeadings } from '@/app/gridGL/UI/gridHeadings/GridHeadings';
import type { CellsSheet } from '@/app/gridGL/cells/CellsSheet';
import { CellsSheets } from '@/app/gridGL/cells/CellsSheets';
import { startupTimer } from '@/app/gridGL/helpers/startupTimer';
import { Pointer } from '@/app/gridGL/interaction/pointer/Pointer';
import { ensureVisible } from '@/app/gridGL/interaction/viewportHelper';
import { isBitmapFontLoaded } from '@/app/gridGL/loadAssets';
import { MomentumScrollDetector } from '@/app/gridGL/pixiApp/MomentumScrollDetector';
import { pixiAppSettings } from '@/app/gridGL/pixiApp/PixiAppSettings';
import { Update } from '@/app/gridGL/pixiApp/Update';
import { urlParams } from '@/app/gridGL/pixiApp/urlParams/urlParams';
import { Viewport } from '@/app/gridGL/pixiApp/viewport/Viewport';
import { getCSSVariableTint } from '@/app/helpers/convertColor';
import { isEmbed } from '@/app/helpers/isEmbed';
import type { JsCoordinate } from '@/app/quadratic-core-types';
import { colors } from '@/app/theme/colors';
import { multiplayer } from '@/app/web-workers/multiplayerWebWorker/multiplayer';
import { renderWebWorker } from '@/app/web-workers/renderWebWorker/renderWebWorker';
import { sharedEvents } from '@/shared/sharedEvents';
import { Container, Graphics, Rectangle, Renderer } from 'pixi.js';

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
  gridLines: GridLines;
  background: Background;
  cursor!: Cursor;
  cellHighlights!: CellHighlights;
  multiplayerCursor!: UIMultiPlayerCursor;

  // this is used to display content over the headings (table name and columns
  // when off the screen)
  private hoverTableHeaders: Container;

  // used to draw selection (via Cursor.ts) for hoverTableHeaders content
  hoverTableColumnsSelection: Graphics;

  cellMoving!: UICellMoving;
  headings!: GridHeadings;
  boxCells!: BoxCells;
  cellsSheets: CellsSheets;
  pointer!: Pointer;
  viewportContents!: Container;
  htmlPlaceholders!: HtmlPlaceholders;
  imagePlaceholders!: Container;
  cellImages!: UICellImages;
  validations: UIValidations;
  copy: UICopy;
  singleCellOutlines: UISingleCellOutlines;

  renderer: Renderer;
  momentumDetector: MomentumScrollDetector;
  stage = new Container();
  loading = true;
  destroyed = false;

  accentColor = colors.cursorCell;

  // for testing purposes
  debug!: Graphics;

  initialized = false;

  // only prepare one copy at a time
  copying = false;

  constructor() {
    // This is created first so it can listen to messages from QuadraticCore.
    this.cellsSheets = new CellsSheets();
    this.gridLines = new GridLines();
    this.cellImages = new UICellImages();
    this.validations = new UIValidations();
    this.hoverTableHeaders = new Container();
    this.hoverTableColumnsSelection = new Graphics();
    this.singleCellOutlines = new UISingleCellOutlines();

    this.canvas = document.createElement('canvas');
    this.renderer = new Renderer({
      view: this.canvas,
      resolution: Math.max(2, window.devicePixelRatio),
      antialias: true,
      backgroundColor: 0xffffff,
    });
    this.viewport = new Viewport(this);
    this.background = new Background();
    this.momentumDetector = new MomentumScrollDetector();
    this.copy = new UICopy();
    this.debug = new Graphics();

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
      // perform a render to warm up the GPU
      this.cellsSheets.showAll(sheets.current);
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

    // this holds the viewport's contents
    this.viewportContents = this.viewport.addChild(new Container());

    this.background = this.viewportContents.addChild(this.background);

    this.cellsSheets = this.viewportContents.addChild(this.cellsSheets);
    this.gridLines = this.viewportContents.addChild(this.gridLines);

    // this is a hack to ensure that table column names appears over the column
    // headings, but under the row headings
    const gridHeadings = new GridHeadings();
    this.viewportContents.addChild(gridHeadings.gridHeadingsRows);

    this.boxCells = this.viewportContents.addChild(new BoxCells());
    this.cellImages = this.viewportContents.addChild(this.cellImages);
    this.multiplayerCursor = this.viewportContents.addChild(new UIMultiPlayerCursor());
    this.cursor = this.viewportContents.addChild(new Cursor());
    this.copy = this.viewportContents.addChild(this.copy);
    this.htmlPlaceholders = this.viewportContents.addChild(new HtmlPlaceholders());
    this.imagePlaceholders = this.viewportContents.addChild(new Container());
    this.cellHighlights = this.viewportContents.addChild(new CellHighlights());
    this.cellMoving = this.viewportContents.addChild(new UICellMoving());
    this.validations = this.viewportContents.addChild(this.validations);
    this.singleCellOutlines = this.viewportContents.addChild(this.singleCellOutlines);
    this.viewportContents.addChild(this.hoverTableHeaders);
    this.viewportContents.addChild(this.hoverTableColumnsSelection);
    this.headings = this.viewportContents.addChild(gridHeadings);

    // useful for debugging at viewport locations
    this.viewportContents.addChild(this.debug);

    this.reset();

    this.pointer = new Pointer(this.viewport);

    this.update = new Update();

    this.setupListeners();
  };

  private setupListeners = () => {
    sharedEvents.on('changeThemeAccentColor', this.setAccentColor);
    window.addEventListener('resize', this.resize);
    document.addEventListener('copy', copyToClipboardEvent);
    document.addEventListener('paste', pasteFromClipboardEvent);
    document.addEventListener('cut', cutToClipboardEvent);
  };

  private removeListeners = () => {
    sharedEvents.off('changeThemeAccentColor', this.setAccentColor);
    window.removeEventListener('resize', this.resize);
    document.removeEventListener('copy', copyToClipboardEvent);
    document.removeEventListener('paste', pasteFromClipboardEvent);
    document.removeEventListener('cut', cutToClipboardEvent);
  };

  // calculate sheet rectangle, without heading, factoring in scale
  getViewportRectangle = (): Rectangle => {
    const headingSize = this.headings.headingSize;
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
    this.gridLines.dirty = true;
    this.headings.dirty = true;
    this.cursor.dirty = true;
    this.cellHighlights.setDirty();
    this.cellsSheets?.cull(this.viewport.getVisibleBounds());

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
    this.setViewportDirty();
  };

  destroy = (): void => {
    this.update.destroy();
    this.renderer.destroy(true);
    this.viewport.destroy();
    this.removeListeners();
    this.destroyed = true;
  };

  setAccentColor = (): void => {
    // Pull the value from the current value as defined in CSS
    const accentColor = getCSSVariableTint('primary');
    this.accentColor = accentColor;
    this.gridLines.dirty = true;
    this.headings.dirty = true;
    this.cursor.dirty = true;
    this.cellHighlights.setDirty();
    this.render();
  };

  resize = (): void => {
    if (!this.parent || this.destroyed) return;
    const width = this.parent.offsetWidth;
    const height = this.parent.offsetHeight;
    this.canvas.width = this.renderer.resolution * width;
    this.canvas.height = this.renderer.resolution * height;
    this.renderer.resize(width, height);
    this.viewport.resize(width, height);
    this.gridLines.dirty = true;
    this.headings.dirty = true;
    this.cursor.dirty = true;
    this.cellHighlights.setDirty();
    this.render();
  };

  // called before and after a render
  prepareForCopying = async (options: {
    sheetId: string;
    cull: Rectangle;
    gridLines?: boolean;
    ai?: boolean;
    thumbnail?: boolean;
  }): Promise<Container> => {
    // this is expensive, so we do it first, before blocking the canvas renderer
    await this.htmlPlaceholders.prepare({ sheetId: options.sheetId, cull: options.cull });

    // this blocks the canvas renderer
    this.copying = true;

    this.gridLines.visible = options.gridLines ?? false;
    this.cursor.visible = options.ai ?? false;
    this.cellHighlights.visible = false;
    this.multiplayerCursor.visible = false;
    this.headings.visible = options.ai ?? false;
    this.boxCells.visible = false;
    this.cellsSheets.toggleOutlines(false);
    this.copy.visible = false;
    this.cellsSheets.cull(options.cull);
    if (options.thumbnail) {
      this.cellsSheet().tables.forceUpdate(options.cull);
    }
    return this.viewportContents;
  };

  cleanUpAfterCopying = (): void => {
    this.gridLines.visible = true;
    this.cursor.visible = true;
    this.cellHighlights.visible = true;
    this.multiplayerCursor.visible = true;
    this.headings.visible = true;
    this.boxCells.visible = true;
    this.htmlPlaceholders.hide();
    this.cellsSheets.toggleOutlines();
    this.copy.visible = true;
    const bounds = this.viewport.getVisibleBounds();
    this.cellsSheets.cull(bounds);
    this.cellsSheet().tables.forceUpdate(bounds);
    this.copying = false;
  };

  render(): void {
    this.renderer.render(this.stage);
  }

  focus(): void {
    this.canvas?.focus();
  }

  reset(): void {
    this.viewport.scale.set(1);
    pixiAppSettings.setEditorInteractionState?.(defaultEditorInteractionState);
  }

  rebuild = () => {
    this.viewport.dirty = true;
    this.gridLines.dirty = true;
    this.headings.dirty = true;
    this.cursor.dirty = true;
    this.cellHighlights.setDirty();
    this.multiplayerCursor.dirty = true;
    this.boxCells.reset();
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
    this.cursor.dirty = true;
    this.cellHighlights.setDirty();
    this.headings.dirty = true;

    if (visible) {
      ensureVisible(visible !== true ? visible : undefined);
    }

    events.emit('cursorPosition');
  }

  adjustHeadings(options: { sheetId: string; delta: number; row: number | null; column: number | null }): void {
    this.cellsSheets.adjustHeadings(options);
    this.cellsSheets.adjustOffsetsBorders(options.sheetId);
    this.cellsSheets.adjustCellsImages(options.sheetId);
    htmlCellsHandler.updateOffsets([sheets.current]);
    if (sheets.current === options.sheetId) {
      this.gridLines.dirty = true;
      this.cursor.dirty = true;
      this.cellHighlights.setDirty();
      this.headings.dirty = true;
      this.multiplayerCursor.dirty = true;
    }
  }

  isCursorOnCodeCellOutput(): boolean {
    return this.cellsSheets.isCursorOnCodeCellOutput();
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

  cellsSheet(): CellsSheet {
    if (!this.cellsSheets.current) {
      throw new Error('cellSheet not found in pixiApp');
    }
    return this.cellsSheets.current;
  }

  changeHoverTableHeaders(hoverTableHeaders: Container) {
    this.hoverTableHeaders.removeChildren();
    this.hoverTableHeaders.addChild(hoverTableHeaders);
  }

  cellsSheetsCreate() {
    this.cellsSheets.create();
  }

  setCursorDirty() {
    if (this.cursor) this.cursor.dirty = true;
  }
}

export const pixiApp = new PixiApp();
