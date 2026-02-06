//! Content is the main container for all data and UI elements. It is
//! independent of any renderer.

import { debugFlag } from '@/app/debugFlags/debugFlags';
import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import type { CellsSheet } from '@/app/gridGL/cells/CellsSheet';
import { CellsSheets } from '@/app/gridGL/cells/CellsSheets';
import { debugTimeCheck, debugTimeReset } from '@/app/gridGL/helpers/debugPerformance';
import { htmlCellsHandler } from '@/app/gridGL/HTMLGrid/htmlCells/htmlCellsHandler';
import { Background } from '@/app/gridGL/UI/Background';
import { BoxCells } from '@/app/gridGL/UI/boxCells';
import { CellHighlights } from '@/app/gridGL/UI/cellHighlights/CellHighlights';
import { Cursor } from '@/app/gridGL/UI/Cursor';
import { GridHeadings } from '@/app/gridGL/UI/gridHeadings/GridHeadings';
import { GridLines } from '@/app/gridGL/UI/GridLines';
import { HtmlPlaceholders } from '@/app/gridGL/UI/HtmlPlaceholders';
import { UICellImages } from '@/app/gridGL/UI/UICellImages';
import { UICellMoving } from '@/app/gridGL/UI/UICellMoving';
import { UICopy } from '@/app/gridGL/UI/UICopy';
import { UIMultiPlayerCursor } from '@/app/gridGL/UI/UIMultiplayerCursor';
import { UISingleCellOutlines } from '@/app/gridGL/UI/UISingleCellOutlines';
import { UIValidations } from '@/app/gridGL/UI/UIValidations';
import { getCSSVariableTint } from '@/app/helpers/convertColor';
import { colors } from '@/app/theme/colors';
import { sharedEvents } from '@/shared/sharedEvents';
import { Container, Graphics, type Rectangle } from 'pixi.js';

export class Content extends Container {
  cellsSheets = new CellsSheets();
  gridLines = new GridLines();
  private background = new Background();
  uiCursor = new Cursor();
  private multiplayerCursor = new UIMultiPlayerCursor();
  cellHighlights = new CellHighlights();

  // this is used to display content over the headings (table name and columns
  // when off the screen)
  private hoverTableHeaders = new Container();

  // used to draw selection (via Cursor.ts) for hoverTableHeaders content
  hoverTableColumnsSelection = new Graphics();

  private cellMoving = new UICellMoving();
  headings = new GridHeadings();
  boxCells = new BoxCells();
  private htmlPlaceholders = new HtmlPlaceholders();
  private imagePlaceholders = new Container();
  cellImages = new UICellImages();
  validations = new UIValidations();
  copy = new UICopy();
  private singleCellOutlines = new UISingleCellOutlines();

  debug = new Graphics();

  copying = false;
  accentColor = colors.cursorCell;

  constructor() {
    super();
    this.addChild(
      this.background,
      this.cellsSheets,
      this.gridLines,
      this.headings.gridHeadingsRows,
      this.boxCells,
      this.cellImages,
      this.multiplayerCursor,
      this.htmlPlaceholders,
      this.imagePlaceholders,
      this.validations,
      this.singleCellOutlines,

      this.uiCursor,
      this.copy,
      this.cellHighlights,
      this.cellMoving,
      this.hoverTableHeaders,
      this.hoverTableColumnsSelection,
      this.headings,

      this.debug
    );

    sharedEvents.on('changeThemeAccentColor', this.setAccentColor);
  }

  destroy = () => {
    sharedEvents.off('changeThemeAccentColor', this.setAccentColor);
    this.multiplayerCursor.destroy();
    super.destroy();
  };

  private setAccentColor = () => {
    // Pull the value from the current value as defined in CSS
    const accentColor = getCSSVariableTint('primary');
    this.accentColor = accentColor;
    events.emit('setDirty', { gridLines: true, headings: true, cursor: true, cellHighlights: true });
  };

  get cellsSheet(): CellsSheet {
    if (!this.cellsSheets.current) {
      throw new Error('cellSheet not found in pixiApp');
    }
    return this.cellsSheets.current;
  }

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
    this.uiCursor.visible = options.ai ?? false;
    this.cellHighlights.visible = false;
    this.multiplayerCursor.visible = false;
    this.headings.visible = options.ai ?? false;
    this.boxCells.visible = false;
    this.cellsSheets.toggleOutlines(false);
    this.copy.visible = false;
    this.cellsSheet.tables.resetFloatingHeaders();
    this.hoverTableHeaders.visible = false;
    this.hoverTableColumnsSelection.visible = false;
    this.cellsSheets.cull(options.cull);
    if (options.thumbnail) {
      this.cellsSheet.tables.forceUpdate(options.cull);
    }
    return this;
  };

  cleanUpAfterCopying = (bounds: Rectangle): void => {
    this.gridLines.visible = true;
    this.uiCursor.visible = true;
    this.cellHighlights.visible = true;
    this.multiplayerCursor.visible = true;
    this.headings.visible = true;
    this.boxCells.visible = true;
    this.htmlPlaceholders.hide();
    this.cellsSheets.toggleOutlines();
    this.copy.visible = true;
    this.hoverTableHeaders.visible = true;
    this.hoverTableColumnsSelection.visible = true;
    this.cellsSheets.cull(bounds);
    this.cellsSheet.tables.forceUpdate(bounds);
    this.copying = false;
  };

  changeHoverTableHeaders = (hoverTableHeaders: Container) => {
    this.hoverTableHeaders.removeChildren();
    this.hoverTableHeaders.addChild(hoverTableHeaders);
  };

  adjustHeadings = (options: { sheetId: string; delta: number; row: number | null; column: number | null }): void => {
    this.cellsSheets.adjustHeadings(options);
    this.cellsSheets.adjustOffsetsBorders(options.sheetId);
    this.cellsSheets.adjustCellsImages(options.sheetId);
    htmlCellsHandler.updateOffsets([sheets.current]);
    if (sheets.current === options.sheetId) {
      events.emit('setDirty', {
        gridLines: true,
        headings: true,
        cursor: true,
        cellHighlights: true,
        multiplayerCursor: true,
      });
    }
  };

  update = (viewportChanged: boolean): boolean => {
    const contentDirty =
      this.gridLines.dirty ||
      this.headings.dirty ||
      this.boxCells.dirty ||
      this.multiplayerCursor.dirty ||
      this.uiCursor.dirty ||
      this.cellImages.dirty ||
      this.cellHighlights.isDirty() ||
      this.cellMoving.dirty ||
      this.validations.dirty ||
      this.copy.dirty ||
      this.singleCellOutlines.dirty ||
      this.cellImages.dirty;

    if (contentDirty && debugFlag('debugShowWhyRendering')) {
      console.log(
        `dirty: ${[
          this.gridLines.dirty && 'gridLines',
          this.headings.dirty && 'headings',
          this.boxCells.dirty && 'boxCells',
          this.multiplayerCursor.dirty && 'multiplayerCursor',
          this.uiCursor.dirty && 'cursor',
          this.cellImages.dirty && 'cellImages',
          this.cellHighlights.isDirty() && 'cellHighlights',
          this.cellMoving.dirty && 'cellMoving',
          this.validations.dirty && 'validations',
          this.copy.dirty && 'copy',
          this.singleCellOutlines.dirty && 'singleCellOutlines',
          this.cellImages.dirty && 'cellImages',
        ]
          .filter(Boolean)
          .join(', ')}`
      );
    }

    debugTimeReset();
    this.gridLines.update();
    debugTimeCheck('[Update] gridLines');
    this.headings.update(viewportChanged);
    debugTimeCheck('[Update] headings');
    this.boxCells.update();
    debugTimeCheck('[Update] boxCells');
    this.cellHighlights.update();
    debugTimeCheck('[Update] cellHighlights');
    this.multiplayerCursor.update(viewportChanged);
    debugTimeCheck('[Update] multiplayerCursor');
    this.cellImages.update();
    debugTimeCheck('[Update] cellImages');
    this.cellMoving.update();
    debugTimeCheck('[Update] cellMoving');
    this.cellsSheets.update(viewportChanged);
    debugTimeCheck('[Update] cellsSheets');
    this.uiCursor.update(viewportChanged);
    debugTimeCheck('[Update] cursor');
    this.validations.update(viewportChanged);
    debugTimeCheck('[Update] validations');
    this.background.update(viewportChanged);
    debugTimeCheck('[Update] backgrounds');
    this.copy.update();
    debugTimeCheck('[Update] copy');
    this.singleCellOutlines.update(viewportChanged);
    debugTimeCheck('[Update] singleCellOutlines');
    this.cellImages.update();
    debugTimeCheck('[Update] cellImages');

    return contentDirty;
  };
}

export const content = new Content();
