import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import type { CellsSheet } from '@/app/gridGL/cells/CellsSheet';
import { CellsSheets } from '@/app/gridGL/cells/CellsSheets';
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
  background = new Background();
  uiCursor = new Cursor();
  multiplayerCursor = new UIMultiPlayerCursor();
  cellHighlights = new CellHighlights();

  // this is used to display content over the headings (table name and columns
  // when off the screen)
  hoverTableHeaders = new Container();

  // used to draw selection (via Cursor.ts) for hoverTableHeaders content
  hoverTableColumnsSelection = new Graphics();

  cellMoving = new UICellMoving();
  headings = new GridHeadings();
  boxCells = new BoxCells();
  viewportContents = new Container();
  htmlPlaceholders = new HtmlPlaceholders();
  imagePlaceholders = new Container();
  cellImages = new UICellImages();
  validations = new UIValidations();
  copy = new UICopy();
  singleCellOutlines = new UISingleCellOutlines();

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

  destroy() {
    sharedEvents.off('changeThemeAccentColor', this.setAccentColor);
    super.destroy();
  }

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
    await content.htmlPlaceholders.prepare({ sheetId: options.sheetId, cull: options.cull });

    // this blocks the canvas renderer
    this.copying = true;

    content.gridLines.visible = options.gridLines ?? false;
    content.uiCursor.visible = options.ai ?? false;
    content.cellHighlights.visible = false;
    content.multiplayerCursor.visible = false;
    content.headings.visible = options.ai ?? false;
    content.boxCells.visible = false;
    content.cellsSheets.toggleOutlines(false);
    content.copy.visible = false;
    content.cellsSheets.cull(options.cull);
    if (options.thumbnail) {
      this.cellsSheet.tables.forceUpdate(options.cull);
    }
    return content;
  };

  cleanUpAfterCopying = (bounds: Rectangle): void => {
    content.gridLines.visible = true;
    content.uiCursor.visible = true;
    content.cellHighlights.visible = true;
    content.multiplayerCursor.visible = true;
    content.headings.visible = true;
    content.boxCells.visible = true;
    content.htmlPlaceholders.hide();
    content.cellsSheets.toggleOutlines();
    content.copy.visible = true;
    content.cellsSheets.cull(bounds);
    this.cellsSheet.tables.forceUpdate(bounds);
    this.copying = false;
  };

  changeHoverTableHeaders(hoverTableHeaders: Container) {
    content.hoverTableHeaders.removeChildren();
    content.hoverTableHeaders.addChild(hoverTableHeaders);
  }

  adjustHeadings(options: { sheetId: string; delta: number; row: number | null; column: number | null }): void {
    content.cellsSheets.adjustHeadings(options);
    content.cellsSheets.adjustOffsetsBorders(options.sheetId);
    content.cellsSheets.adjustCellsImages(options.sheetId);
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
  }
}

export const content = new Content();
