import { CellsSheets } from '@/app/gridGL/cells/CellsSheets';
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
import { Container, Graphics } from 'pixi.js';

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
  }
}

export const content = new Content();
