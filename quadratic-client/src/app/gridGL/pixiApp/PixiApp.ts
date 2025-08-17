import './pixiApp.css';

import { defaultEditorInteractionState } from '@/app/atoms/editorInteractionStateAtom';
import { events } from '@/app/events/events';
import {
  copyToClipboardEvent,
  cutToClipboardEvent,
  pasteFromClipboardEvent,
} from '@/app/grid/actions/clipboard/clipboard';
import { sheets } from '@/app/grid/controller/Sheets';
import { BaseApp } from '@/app/gridGL/BaseApp';
import { htmlCellsHandler } from '@/app/gridGL/HTMLGrid/htmlCells/htmlCellsHandler';
import { Background } from '@/app/gridGL/UI/Background';
import { Cursor } from '@/app/gridGL/UI/Cursor';
import { HtmlPlaceholders } from '@/app/gridGL/UI/HtmlPlaceholders';
import { UICellImages } from '@/app/gridGL/UI/UICellImages';
import { UICellMoving } from '@/app/gridGL/UI/UICellMoving';
import { UICopy } from '@/app/gridGL/UI/UICopy';
import { UIMultiPlayerCursor } from '@/app/gridGL/UI/UIMultiplayerCursor';
import { UISingleCellOutlines } from '@/app/gridGL/UI/UISingleCellOutlines';
import { UIValidations } from '@/app/gridGL/UI/UIValidations';
import { BoxCells } from '@/app/gridGL/UI/boxCells';
import { CellHighlights } from '@/app/gridGL/UI/cellHighlights/CellHighlights';
import type { CellsSheet } from '@/app/gridGL/cells/CellsSheet';
import { Pointer } from '@/app/gridGL/interaction/pointer/Pointer';
import { ensureVisible } from '@/app/gridGL/interaction/viewportHelper';
import { isBitmapFontLoaded } from '@/app/gridGL/loadAssets';
import { MomentumScrollDetector } from '@/app/gridGL/pixiApp/MomentumScrollDetector';
import { pixiAppSettings } from '@/app/gridGL/pixiApp/PixiAppSettings';
import { Update } from '@/app/gridGL/pixiApp/Update';
import { urlParams } from '@/app/gridGL/pixiApp/urlParams/urlParams';
import { isEmbed } from '@/app/helpers/isEmbed';
import type { JsCoordinate } from '@/app/quadratic-core-types';
import { multiplayer } from '@/app/web-workers/multiplayerWebWorker/multiplayer';
import { renderWebWorker } from '@/app/web-workers/renderWebWorker/renderWebWorker';
import { Container, Graphics, Rectangle } from 'pixi.js';

export class PixiApp extends BaseApp {
  private update: Update;

  // Used to track whether we're done with the first render (either before or
  // after init is called, depending on timing).
  private waitingForFirstRender?: Function;
  private alreadyRendered = false;

  // this is used to display content over the headings (table name and columns
  // when off the screen)
  private hoverTableHeaders: Container;

  // used to draw selection (via Cursor.ts) for hoverTableHeaders content
  hoverTableColumnsSelection: Graphics;

  stage = new Container();
  loading = true;

  // for testing purposes
  debug!: Graphics;

  initialized = false;

  // only prepare one copy at a time
  copying = false;

  constructor() {
    super();
    this.canvas.id = 'QuadraticCanvasID';

    // This is created first so it can listen to messages from QuadraticCore.
    this.cellImages = new UICellImages();
    this.validations = new UIValidations();
    this.hoverTableHeaders = new Container();
    this.hoverTableColumnsSelection = new Graphics();
    this.singleCellOutlines = new UISingleCellOutlines();
    this.htmlPlaceholders = new HtmlPlaceholders();
    this.boxCells = new BoxCells();
    this.cellImages = new UICellImages();
    this.cellHighlights = new CellHighlights();
    this.cellMoving = new UICellMoving();

    this.background = new Background();
    this.momentumDetector = new MomentumScrollDetector();
    this.copy = new UICopy();
    this.debug = new Graphics();

    this.update = new Update();

    events.on('debugFlags', this.setViewportDirty);
  }

  init = (): Promise<void> => {
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
  };

  private initCanvas = () => {
    if (
      !this.cellImages ||
      !this.copy ||
      !this.htmlPlaceholders ||
      !this.cellHighlights ||
      !this.cellMoving ||
      !this.validations ||
      !this.singleCellOutlines ||
      !this.boxCells ||
      !this.cellMoving ||
      !this.cellHighlights
    ) {
      debugger;
      console.warn('Expected pixiApp to properly be defined in initCanvas');
      return;
    }
    this.stage.addChild(this.viewport);

    // this holds the viewport's contents
    this.viewport.addChild(this.viewportContents);

    if (this.background) {
      this.viewportContents.addChild(this.background);
    }

    this.cellsSheets = this.viewportContents.addChild(this.cellsSheets);
    this.gridLines = this.viewportContents.addChild(this.gridLines);

    // this is a hack to ensure that table column names appears over the column
    // headings, but under the row headings
    this.viewportContents.addChild(this.headings.gridHeadingsRows);

    this.viewportContents.addChild(this.boxCells);
    this.viewportContents.addChild(this.cellImages);
    this.multiplayerCursor = this.viewportContents.addChild(new UIMultiPlayerCursor());
    this.cursor = this.viewportContents.addChild(new Cursor());
    this.copy = this.viewportContents.addChild(this.copy);
    this.viewportContents.addChild(this.htmlPlaceholders);
    this.imagePlaceholders = this.viewportContents.addChild(new Container());
    this.viewportContents.addChild(new CellHighlights());
    this.viewportContents.addChild(new UICellMoving());
    this.validations = this.viewportContents.addChild(this.validations);
    this.singleCellOutlines = this.viewportContents.addChild(this.singleCellOutlines);
    this.viewportContents.addChild(this.hoverTableHeaders);
    this.viewportContents.addChild(this.hoverTableColumnsSelection);
    this.viewportContents.addChild(this.headings);

    // useful for debugging at viewport locations
    this.viewportContents.addChild(this.debug);

    this.reset();

    this.pointer = new Pointer(this.viewport);

    this.setupPixiListeners();
  };

  protected setupPixiListeners() {
    window.addEventListener('resize', this.resize);
    document.addEventListener('copy', copyToClipboardEvent);
    document.addEventListener('paste', pasteFromClipboardEvent);
    document.addEventListener('cut', cutToClipboardEvent);
  }

  protected removePixiListeners() {
    window.removeEventListener('resize', this.resize);
    document.removeEventListener('copy', copyToClipboardEvent);
    document.removeEventListener('paste', pasteFromClipboardEvent);
    document.removeEventListener('cut', cutToClipboardEvent);
  }

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
    if (this.cursor) {
      this.cursor.dirty = true;
    }
    if (this.cellHighlights) {
      this.cellHighlights.setDirty();
    }
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

    parent.appendChild(this.canvas);
    this.resize();
    this.update.start();
    if (!isEmbed) {
      this.canvas.focus();
    }
    urlParams.show();
    this.setViewportDirty();
  };

  destroy() {
    super.destroy();
    this.update.destroy();
    this.renderer.destroy(true);
    this.viewport.destroy();
    this.removePixiListeners();
  }

  // called before and after a render
  prepareForCopying = async (options: {
    sheetId: string;
    cull: Rectangle;
    gridLines?: boolean;
    ai?: boolean;
    thumbnail?: boolean;
  }): Promise<Container> => {
    if (!this.htmlPlaceholders || !this.boxCells || !this.copy) {
      console.warn('Expected pixiApp to properly be defined in prepareForCopying');
      return this.viewportContents!;
    }
    // this is expensive, so we do it first, before blocking the canvas renderer
    await this.htmlPlaceholders.prepare({ sheetId: options.sheetId, cull: options.cull });

    // this blocks the canvas renderer
    this.copying = true;

    this.gridLines.visible = options.gridLines ?? false;
    if (this.cursor) {
      this.cursor.visible = options.ai ?? false;
    }
    if (this.cellHighlights) {
      this.cellHighlights.visible = false;
    }
    if (this.multiplayerCursor) {
      this.multiplayerCursor.visible = false;
    }
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
    if (
      !this.gridLines ||
      !this.cursor ||
      !this.cellHighlights ||
      !this.multiplayerCursor ||
      !this.headings ||
      !this.boxCells ||
      !this.htmlPlaceholders ||
      !this.copy
    ) {
      console.warn('Expected pixiApp to properly be defined in cleanUpAfterCopying');
      return;
    }
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
    if (!this.boxCells) return;
    this.viewport.dirty = true;
    this.gridLines.dirty = true;
    this.headings.dirty = true;
    if (this.cursor) {
      this.cursor.dirty = true;
    }
    if (this.cellHighlights) {
      this.cellHighlights.setDirty();
    }
    if (this.multiplayerCursor) {
      this.multiplayerCursor.dirty = true;
    }
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
    if (this.cursor) {
      this.cursor.dirty = true;
    }
    if (this.cellHighlights) {
      this.cellHighlights.setDirty();
    }
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
      if (this.cursor) {
        this.cursor.dirty = true;
      }
      if (this.cellHighlights) {
        this.cellHighlights.setDirty();
      }
      this.headings.dirty = true;
      if (this.multiplayerCursor) {
        this.multiplayerCursor.dirty = true;
      }
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

  forceUpdate() {
    this.update.updateOnly(this);
  }
}

export const pixiApp = new PixiApp();
