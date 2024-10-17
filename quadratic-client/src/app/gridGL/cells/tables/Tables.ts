//! Tables renders all pixi-based UI elements for tables. Right now that's the
//! headings.

import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { Sheet } from '@/app/grid/sheet/Sheet';
import { CellsSheet } from '@/app/gridGL/cells/CellsSheet';
import { Table } from '@/app/gridGL/cells/tables/Table';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { JsRenderCodeCell } from '@/app/quadratic-core-types';
import { Container, Point } from 'pixi.js';

export class Tables extends Container<Table> {
  private cellsSheet: CellsSheet;

  private activeTable: Table | undefined;
  private hoverTable: Table | undefined;

  constructor(cellsSheet: CellsSheet) {
    super();
    this.cellsSheet = cellsSheet;
    events.on('renderCodeCells', this.renderCodeCells);
    // todo: update code cells?

    events.on('cursorPosition', this.cursorPosition);
    events.on('sheetOffsets', this.sheetOffsets);
    events.on('changeSheet', this.changeSheet);
  }

  get sheet(): Sheet {
    const sheet = sheets.getById(this.cellsSheet.sheetId);
    if (!sheet) {
      throw new Error('Sheet not found in Tables');
    }
    return sheet;
  }

  private renderCodeCells = (sheetId: string, codeCells: JsRenderCodeCell[]) => {
    if (sheetId === this.cellsSheet.sheetId) {
      this.removeChildren();
      codeCells.forEach((codeCell) => this.addChild(new Table(this.sheet, codeCell)));
    }
  };

  update(dirtyViewport: boolean) {
    if (dirtyViewport) {
      const bounds = pixiApp.viewport.getVisibleBounds();
      const gridHeading = pixiApp.headings.headingSize.height / pixiApp.viewport.scale.y;
      this.children.forEach((heading) => {
        heading.update(bounds, gridHeading);
      });
    }
  }

  // Updates the active table when the cursor moves.
  private cursorPosition = () => {
    if (this.sheet.id !== sheets.sheet.id) {
      return;
    }
    if (this.activeTable) {
      this.activeTable.hideActive();
    }
    const cursor = sheets.sheet.cursor.cursorPosition;
    this.activeTable = this.children.find((table) => table.intersectsCursor(cursor.x, cursor.y));
  };

  // Redraw the headings if the offsets change.
  sheetOffsets = (sheetId: string) => {
    if (sheetId === this.sheet.id) {
      this.children.map((table) => table.redraw());
    }
  };

  private changeSheet = (sheetId: string) => {
    if (sheetId === this.sheet.id) {
      this.children.forEach((table) => {
        table.addTableNames();
      });
    } else {
      this.children.forEach((table) => {
        table.removeTableNames();
      });
    }
  };

  // Checks if the mouse cursor is hovering over a table or table heading.
  checkHover(world: Point) {
    const hover = this.children.find((table) => table.checkHover(world));
    if (hover !== this.hoverTable) {
      if (this.hoverTable) {
        this.hoverTable.hideActive();
      }
      this.hoverTable = hover;
      if (this.hoverTable) {
        this.hoverTable.showActive();
      }
    }
  }

  pointerDown(world: Point): { table: Table; nameOrDropdown: 'name' | 'dropdown' } | undefined {
    for (const table of this.children) {
      const result = table.intersectsTableName(world);
      if (result) {
        return result;
      }
    }
  }
}
