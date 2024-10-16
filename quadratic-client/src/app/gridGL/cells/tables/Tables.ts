/* eslint-disable @typescript-eslint/no-unused-vars */
import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { Sheet } from '@/app/grid/sheet/Sheet';
import { CellsSheet } from '@/app/gridGL/cells/CellsSheet';
import { JsRenderCodeCell } from '@/app/quadratic-core-types';
import { colors } from '@/app/theme/colors';
import { FONT_SIZE, OPEN_SANS_FIX } from '@/app/web-workers/renderWebWorker/worker/cellsLabel/CellLabel';
import { BitmapText, Container, Graphics, Rectangle } from 'pixi.js';

interface Column {
  heading: Container;
  bounds: Rectangle;
}

interface TableHeading {
  container: Container;
  headingBounds: Rectangle;
  originalHeadingBounds: Rectangle;
  columns: Column[];
  codeCell: JsRenderCodeCell;
}

export class Tables extends Container {
  private cellsSheet: CellsSheet;

  constructor(cellsSheet: CellsSheet) {
    super();
    this.cellsSheet = cellsSheet;
    events.on('renderCodeCells', this.renderCodeCells);

    // todo: update code cells?
  }

  get sheet(): Sheet {
    const sheet = sheets.getById(this.cellsSheet.sheetId);
    if (!sheet) {
      throw new Error('Sheet not found in Tables');
    }
    return sheet;
  }

  cull() {}

  private renderHeadings = (codeCell: JsRenderCodeCell): TableHeading => {
    const container = this.addChild(new Container());
    console.log(codeCell.x);
    const headingBounds = this.sheet.getScreenRectangle(codeCell.x, codeCell.y, codeCell.column_names.length - 1, 0);
    const originalHeadingBounds = headingBounds.clone();
    container.position.set(headingBounds.x, headingBounds.y);

    // draw heading background
    const background = container.addChild(new Graphics());
    background.beginFill(colors.tableHeadingBackground);
    background.drawShape(new Rectangle(0, 0, headingBounds.width, headingBounds.height));
    background.endFill();

    // draw individual headings
    let x = 0;
    const columns: Column[] = codeCell.column_names.map((column, index) => {
      const width = this.sheet.offsets.getColumnWidth(codeCell.x + index);
      const bounds = new Rectangle(x, headingBounds.y, width, headingBounds.height);
      const heading = container.addChild(new Container());
      heading.position.set(x + OPEN_SANS_FIX.x, OPEN_SANS_FIX.y);
      heading.addChild(
        new BitmapText(column.name, {
          fontName: 'OpenSans-Bold',
          fontSize: FONT_SIZE,
          tint: colors.tableHeadingForeground,
        })
      );
      x += width;
      return { heading, bounds };
    });

    return {
      container,
      headingBounds,
      originalHeadingBounds,
      columns,
      codeCell,
    };
  };

  private renderCodeCells = (sheetId: string, codeCells: JsRenderCodeCell[]) => {
    if (sheetId === this.cellsSheet.sheetId) {
      this.removeChildren();
      codeCells.forEach((codeCell) => this.renderHeadings(codeCell));
    }
  };
}
