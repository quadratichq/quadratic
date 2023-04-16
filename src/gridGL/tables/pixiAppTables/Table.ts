import { Container } from 'pixi.js';
import { PixiAppTables } from './PixiAppTables';
import { Sheet } from '../../../grid/sheet/Sheet';
import { debugTimeCheck, debugTimeReset } from 'gridGL/helpers/debugPerformance';
import { GridLines } from '../UI/GridLines';
import { Quadrants } from '../quadrants/Quadrants';
import { Cells } from '../UI/cells/Cells';
import { TableUI } from './TableUI';

export class Table extends Container {
  app: PixiAppTables;
  sheet: Sheet;

  tableUI: TableUI;
  gridLines: GridLines;
  cells: Cells;
  quadrants: Quadrants;

  // todo: make this real
  actualWidth = 1000;
  actualHeight = 1000;

  constructor(app: PixiAppTables, sheet: Sheet) {
    super();
    this.app = app;
    this.sheet = sheet;

    this.gridLines = this.addChild(new GridLines(this));

    this.quadrants = this.addChild(new Quadrants(this));
    this.quadrants.visible = false;

    this.cells = this.addChild(new Cells(this));

    // ensure the cell's background color is drawn first
    this.addChildAt(this.cells.cellsBackground, 0);

    this.tableUI = this.addChild(new TableUI(this));
  }

  get selected(): boolean {
    return this.app.tables.table === this;
  }

  showQuadrants(): void {
    this.cells.changeVisibility(false);
    this.quadrants.visible = true;
  }

  showCells(): void {
    this.cells.dirty = true;
    this.cells.changeVisibility(true);
    this.quadrants.visible = false;
  }

  viewportChanged(): void {
    this.gridLines.dirty = true;
  }

  update(): void {
    debugTimeReset();
    this.gridLines.update();
    debugTimeCheck('[Update] gridLines');
    this.cells.update();
    debugTimeCheck('[Update] cells');

    // app.cells.update();
    // debugTimeCheck('[Update] cells');
    // app.cursor.update();
    // debugTimeCheck('[Update] cursor');

    this.tableUI.update();
  }
}
