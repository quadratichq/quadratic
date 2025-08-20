//! Displays all content and UI elements for the file.

import { debugFlag } from '@/app/debugFlags/debugFlags';
import { CellsSheets } from '@/app/gridGL/cells/CellsSheets';
import { debugTimeCheck, debugTimeReset } from '@/app/gridGL/helpers/debugPerformance';
import type { Viewport } from '@/app/gridGL/pixiApp/viewport/Viewport';
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
import { Container, Graphics } from 'pixi.js';

export class Content extends Container {
  // forces a rerender of the content even if all the other content is not
  // dirty
  private dirty = false;

  accentColor = colors.cursorCell;

  // used to draw selection (via Cursor.ts) for hoverTableHeaders content
  private hoverTableColumnsSelection = new Graphics();

  private background = new Background();
  private cellsSheets = new CellsSheets(this);
  gridLines = new GridLines();
  private headings = new GridHeadings(this);
  private boxCells = new BoxCells(this);
  private cellImages = new UICellImages();
  private uiMultiPlayerCursor = new UIMultiPlayerCursor();
  private uiCursor = new Cursor();
  private uiCopy = new UICopy();
  private htmlPlaceholders = new HtmlPlaceholders();
  private imagePlaceholders = new Container();
  private cellHighlights = new CellHighlights();
  private cellMoving = new UICellMoving();
  private validations = new UIValidations();
  private singleCellOutlines = new UISingleCellOutlines();

  // this is used to display content over the headings (table name and columns
  // when off the screen)
  private hoverTableHeaders = new Container();

  private debug = new Graphics();

  /// Initializes the content.
  init() {
    // z-order for the content
    this.addChild(
      this.background,
      this.cellsSheets,
      this.gridLines,
      this.headings.gridHeadingsRows,
      this.boxCells,
      this.cellImages,
      this.uiMultiPlayerCursor,
      this.uiCursor,
      this.uiCopy,
      this.htmlPlaceholders,
      this.imagePlaceholders,
      this.cellHighlights,
      this.cellMoving,
      this.validations,
      this.singleCellOutlines,
      this.hoverTableHeaders,
      this.hoverTableColumnsSelection,
      this.headings,
      this.debug
    );

    sharedEvents.on('changeThemeAccentColor', this.setAccentColor);
  }

  destroy() {
    super.destroy();
    sharedEvents.off('changeThemeAccentColor', this.setAccentColor);
  }

  changeHoverTableHeaders(hoverTableHeaders: Container) {
    this.hoverTableHeaders.removeChildren();
    this.hoverTableHeaders.addChild(hoverTableHeaders);
  }

  private setAccentColor = (): void => {
    // Pull the value from the current value as defined in CSS
    const accentColor = getCSSVariableTint('primary');
    this.accentColor = accentColor;
    this.setDirty({ gridLines: true, headings: true, cursor: true, cellHighlights: true });
  };

  /// Sets the dirty state of the content or any of its children.
  setDirty(options?: { gridLines?: boolean; headings?: boolean; cursor?: boolean; cellHighlights?: boolean }) {
    if (!options) {
      this.dirty = true;
      return;
    }
    if (options.gridLines) {
      this.gridLines.dirty = true;
    }
    if (options.headings) {
      this.headings.dirty = true;
    }
    if (options.cellHighlights) {
      this.cellHighlights.setDirty();
    }
  }

  isDirty() {
    return this.dirty;
  }

  update(viewport: Viewport): boolean {
    const viewportChanged = viewport.updateViewport();
    let rendererDirty =
      this.gridLines.dirty ||
      this.headings.dirty ||
      this.boxCells?.dirty ||
      this.uiMultiPlayerCursor.dirty ||
      this.uiCursor.dirty ||
      this.cellImages.dirty ||
      this.cellHighlights.isDirty() ||
      this.cellMoving.dirty ||
      this.validations.dirty ||
      this.uiCopy.dirty ||
      this.singleCellOutlines.dirty;

    if (rendererDirty && debugFlag('debugShowWhyRendering')) {
      console.log(
        `dirty: ${[
          viewport.dirty && 'viewport',
          this.gridLines.dirty && 'gridLines',
          this.headings.dirty && 'headings',
          this.boxCells?.dirty && 'boxCells',
          this.uiMultiPlayerCursor.dirty && 'multiplayerCursor',
          this.uiCursor.dirty && 'cursor',
          this.cellImages.dirty && 'cellImages',
          this.cellHighlights.isDirty() && 'cellHighlights',
          this.cellMoving.dirty && 'cellMoving',
          this.validations.dirty && 'validations',
          this.uiCopy.dirty && 'copy',
          this.singleCellOutlines.dirty && 'singleCellOutlines',
        ]
          .filter(Boolean)
          .join(', ')}`
      );
    }

    debugTimeReset();
    this.gridLines.update();
    debugTimeCheck('[Update] gridLines');
    this.headings.update(viewport.dirty);
    debugTimeCheck('[Update] headings');
    this.boxCells?.update();
    debugTimeCheck('[Update] boxCells');
    this.cellHighlights?.update();
    debugTimeCheck('[Update] cellHighlights');
    this.uiMultiPlayerCursor?.update(viewport.dirty);
    debugTimeCheck('[Update] multiplayerCursor');
    this.cellImages.update();
    debugTimeCheck('[Update] cellImages');
    this.cellMoving.update();
    debugTimeCheck('[Update] cellMoving');
    this.cellsSheets.update(viewport.dirty);
    debugTimeCheck('[Update] cellsSheets');
    this.uiCursor.update(viewport.dirty);
    debugTimeCheck('[Update] cursor');
    this.validations.update(viewport.dirty);
    debugTimeCheck('[Update] validations');
    this.background.update(viewport);
    debugTimeCheck('[Update] backgrounds');
    this.uiCopy.update();
    debugTimeCheck('[Update] copy');
    this.singleCellOutlines.update(viewportChanged);
    debugTimeCheck('[Update] singleCellOutlines');
    return !!rendererDirty;
  }
}
