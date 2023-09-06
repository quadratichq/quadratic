import { Container, Rectangle } from 'pixi.js';
import { SheetId } from '../../quadratic-core/types';
import { PixiApp } from '../pixiApp/PixiApp';
import { pixiAppEvents } from '../pixiApp/PixiAppEvents';
import { Coordinate } from '../types/size';
import { CellsSheet } from './CellsSheet';

export class CellsSheets extends Container<CellsSheet> {
  private app: PixiApp;
  private current?: CellsSheet;

  constructor(app: PixiApp) {
    super();
    this.app = app;
  }

  async create(): Promise<void> {
    this.removeChildren();
    if (!this.app.sheetController.sheets.size) return;
    this.app.sheetController.sheets.forEach(async (sheet) => {
      const child = this.addChild(new CellsSheet(sheet));
      await child.preload();
      if (sheet.id === this.app.sheetController.sheet.id) {
        this.current = child;
      }
    });
    this.show(this.app.sheetController.sheet.id);
  }

  async addSheet(id: string): Promise<void> {
    const sheet = this.app.sheetController.sheets.getById(id);
    if (!sheet) {
      throw new Error('Expected to find new sheet in cellSheet');
    }
    const cellsSheet = this.addChild(new CellsSheet(sheet));
    await cellsSheet.preload();
    this.show(sheet.id);
  }

  deleteSheet(id: string): void {
    const cellsSheet = this.children.find((cellsSheet) => cellsSheet.sheet.id === id);
    if (!cellsSheet) {
      throw new Error('Expected to find cellsSheet in CellSheets.delete');
    }
    this.removeChild(cellsSheet);
    cellsSheet.destroy();
  }

  show(id: string): void {
    this.children.forEach((child) => {
      if (child.sheet.id === id) {
        if (this.current?.sheet.id !== child?.sheet.id) {
          this.current = child;
          child.show(this.app.viewport.getVisibleBounds());
          pixiAppEvents.loadViewport();
        }
      } else {
        child.hide();
      }
    });
  }

  cull(bounds: Rectangle): void {
    if (!this.current) throw new Error('Expected current to be defined in CellsSheets');
    this.current.show(bounds);
  }

  changed(options: {
    sheetId: string;
    column?: number;
    row?: number;
    cells?: Coordinate[];
    rectangle?: Rectangle;
    labels: boolean;
    background: boolean;
  }): void {
    const cellsSheet = this.children.find((search) => search.sheet.id === options.sheetId);
    if (!cellsSheet) throw new Error('Expected to find cellsSheet in changed');
    cellsSheet.changed({
      cells: options.cells,
      column: options.column,
      row: options.row,
      rectangle: options.rectangle,
      labels: options.labels,
      background: options.background,
    });
  }

  // this updates the first dirty CellsSheet, always starting with the current sheet
  update(): void {
    if (!this.current) throw new Error('Expected current to be defined in CellsSheets');
    if (this.current.update()) {
      this.app.setViewportDirty();
      return;
    }
    for (const child of this.children) {
      if (this.current !== child) {
        if (child.update()) {
          this.app.setViewportDirty();
          return;
        }
      }
    }
  }

  toggleOutlines(): void {
    this.current?.toggleOutlines();
  }

  createBorders(): void {
    this.current?.createBorders();
  }

  updateFills(sheetIds: SheetId[]): void {
    this.children.forEach((cellsSheet) => {
      if (sheetIds.find((id) => id.id === cellsSheet.sheet.id)) {
        cellsSheet.updateFill();
      }
    });
  }
}
