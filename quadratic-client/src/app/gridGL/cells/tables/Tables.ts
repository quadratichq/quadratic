//! Tables renders all pixi-based UI elements for tables. Right now that's the
//! headings.

/* eslint-disable @typescript-eslint/no-unused-vars */
import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { Sheet } from '@/app/grid/sheet/Sheet';
import { CellsSheet } from '@/app/gridGL/cells/CellsSheet';
import { intersects } from '@/app/gridGL/helpers/intersects';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { getCSSVariableTint } from '@/app/helpers/convertColor';
import { JsRenderCodeCell } from '@/app/quadratic-core-types';
import { colors } from '@/app/theme/colors';
import { FONT_SIZE, OPEN_SANS_FIX } from '@/app/web-workers/renderWebWorker/worker/cellsLabel/CellLabel';
import { BitmapText, Container, Graphics, Rectangle } from 'pixi.js';

interface Column {
  heading: Container;
  bounds: Rectangle;
}

interface Table {
  container: Container;
  headingContainer: Container;
  bounds: Rectangle;
  outline: Graphics;
  // headingLine: Graphics;
  headingBounds: Rectangle;
  originalHeadingBounds: Rectangle;
  columns: Column[];
  codeCell: JsRenderCodeCell;
}

export class Tables extends Container {
  private cellsSheet: CellsSheet;
  private tables: Table[];

  private activeTable: Table | undefined;
  private hoverTable: Table | undefined;

  constructor(cellsSheet: CellsSheet) {
    super();
    this.cellsSheet = cellsSheet;
    this.tables = [];
    events.on('renderCodeCells', this.renderCodeCells);
    // todo: update code cells?

    events.on('cursorPosition', this.cursorPosition);
    events.on('hoverTable', this.setHoverTable);

    events.on('sheetOffsets', this.sheetOffsets);
  }

  get sheet(): Sheet {
    const sheet = sheets.getById(this.cellsSheet.sheetId);
    if (!sheet) {
      throw new Error('Sheet not found in Tables');
    }
    return sheet;
  }

  cull() {
    const bounds = pixiApp.viewport.getVisibleBounds();
    this.tables.forEach((heading) => {
      heading.container.visible = intersects.rectangleRectangle(heading.bounds, bounds);
    });
  }

  private renderCodeCell = (codeCell: JsRenderCodeCell) => {
    const container = this.addChild(new Container());

    const bounds = this.sheet.getScreenRectangle(codeCell.x, codeCell.y, codeCell.w - 1, codeCell.h - 1);
    const headingHeight = this.sheet.offsets.getRowHeight(codeCell.y);
    const headingBounds = new Rectangle(bounds.x, bounds.y, bounds.width, headingHeight);
    const originalHeadingBounds = headingBounds.clone();
    container.position.set(headingBounds.x, headingBounds.y);

    // draw individual headings
    const headingContainer = container.addChild(new Container());

    // draw heading background
    const background = headingContainer.addChild(new Graphics());
    background.beginFill(colors.tableHeadingBackground);
    background.drawShape(new Rectangle(0, 0, headingBounds.width, headingBounds.height));
    background.endFill();

    // // draw heading line
    // const headingLine = headingContainer.addChild(new Graphics());
    // headingLine.lineStyle({ color: getCSSVariableTint('primary'), width: 2, alignment: 0 });
    // headingLine.moveTo(0, headingHeight).lineTo(headingBounds.width, headingHeight);
    // headingLine.visible = false;

    let x = 0;
    const columns: Column[] = codeCell.column_names.map((column, index) => {
      const width = this.sheet.offsets.getColumnWidth(codeCell.x + index);
      const bounds = new Rectangle(x, headingBounds.y, width, headingBounds.height);
      const heading = headingContainer.addChild(new Container());
      heading.position.set(x + OPEN_SANS_FIX.x, OPEN_SANS_FIX.y);
      heading.addChild(
        new BitmapText(column.name, {
          fontName: 'OpenSans-Bold',
          fontSize: FONT_SIZE,
          tint: colors.tableHeadingForeground,
        })
      );

      // // draw heading line between columns
      // if (index !== codeCell.column_names.length - 1) {
      //   headingLine.moveTo(x + width, 0).lineTo(x + width, headingHeight);
      // }
      x += width;
      return { heading, bounds };
    });

    // draw outline
    const outline = container.addChild(new Graphics());
    outline.lineStyle({ color: getCSSVariableTint('primary'), width: 2, alignment: 0 });
    outline.drawShape(new Rectangle(0, 0, bounds.width, bounds.height));
    outline.visible = false;

    this.tables.push({
      container,
      bounds,
      headingBounds,
      headingContainer,
      outline,
      // headingLine,
      originalHeadingBounds,
      columns,
      codeCell,
    });
  };

  private renderCodeCells = (sheetId: string, codeCells: JsRenderCodeCell[]) => {
    if (sheetId === this.cellsSheet.sheetId) {
      this.removeChildren();
      this.tables = [];
      codeCells.forEach((codeCell) => this.renderCodeCell(codeCell));
    }
  };

  private headingPosition = () => {
    const bounds = pixiApp.viewport.getVisibleBounds();
    const gridHeading = pixiApp.headings.headingSize.height / pixiApp.viewport.scaled;
    this.tables.forEach((heading) => {
      if (heading.container.visible) {
        if (heading.headingBounds.top < bounds.top + gridHeading) {
          heading.headingContainer.y = bounds.top + gridHeading - heading.headingBounds.top;
        } else {
          heading.headingContainer.y = 0;
        }
      }
    });
  };

  update(dirtyViewport: boolean) {
    if (dirtyViewport) {
      this.cull();
      this.headingPosition();
    }
  }

  // Updates the active table when the cursor moves.
  private cursorPosition = () => {
    if (this.sheet.id !== sheets.sheet.id) {
      return;
    }
    if (this.activeTable) {
      this.activeTable.outline.visible = false;
      // this.activeTable.headingLine.visible = false;
      pixiApp.setViewportDirty();
    }
    const cursor = sheets.sheet.cursor.cursorPosition;
    this.activeTable = this.tables.find((table) => {
      const rect = new Rectangle(table.codeCell.x, table.codeCell.y, table.codeCell.w - 1, table.codeCell.h - 1);
      return intersects.rectanglePoint(rect, cursor);
    });
    if (this.activeTable) {
      this.activeTable.outline.visible = true;
      // this.activeTable.headingLine.visible = true;
      pixiApp.setViewportDirty();
    }
  };

  private setHoverTable = (codeCell?: JsRenderCodeCell) => {
    if (this.sheet.id !== sheets.sheet.id) {
      return;
    }
    if (!codeCell) {
      if (this.hoverTable) {
        if (this.hoverTable !== this.activeTable) {
          this.hoverTable.outline.visible = false;
          // this.hoverTable.headingLine.visible = false;
          pixiApp.setViewportDirty();
        }
        this.hoverTable = undefined;
      }
      return;
    }
    this.hoverTable = this.tables.find((table) => table.codeCell.x === codeCell.x && table.codeCell.y === codeCell.y);
    if (this.hoverTable) {
      this.hoverTable.outline.visible = true;
      // this.hoverTable.headingLine.visible = true;
      pixiApp.setViewportDirty();
    }
  };

  // Redraw the headings if the offsets change.
  sheetOffsets = (sheetId: string) => {
    if (sheetId === this.sheet.id) {
      this.renderCodeCells(
        sheetId,
        this.tables.map((table) => table.codeCell)
      );
    }
  };
}
