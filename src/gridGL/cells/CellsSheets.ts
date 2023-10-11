import { Container, Rectangle } from 'pixi.js';
import { sheets } from '../../grid/controller/Sheets';
import { OperationSummary, SheetId } from '../../quadratic-core/types';
import { pixiApp } from '../pixiApp/PixiApp';
import { Coordinate } from '../types/size';
import { CellsSheet } from './CellsSheet';

export class CellsSheets extends Container<CellsSheet> {
  private current?: CellsSheet;

  async create(): Promise<void> {
    this.removeChildren();
    if (!sheets.size) return;

    for (const sheet of sheets.sheets) {
      const child = this.addChild(new CellsSheet(sheet));
      await child.preload();
      if (sheet.id === sheets.sheet.id) {
        this.current = child;
      }
    }
  }

  isReady(): boolean {
    return !!this.current;
  }

  async addSheet(id: string): Promise<void> {
    const sheet = sheets.getById(id);
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
          child.show(pixiApp.viewport.getVisibleBounds());
          pixiApp.loadViewport();
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

  private getById(id: string): CellsSheet | undefined {
    return this.children.find((search) => search.sheet.id === id);
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
    const cellsSheet = this.getById(options.sheetId);
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
      pixiApp.setViewportDirty();
      return;
    }
    for (const child of this.children) {
      if (this.current !== child) {
        if (child.update()) return;
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

  // adjust headings without recalculating the glyph geometries
  adjustHeadings(options: { sheetId: string; delta: number; row?: number; column?: number }): void {
    const { sheetId, delta, row, column } = options;
    const cellsSheet = this.getById(sheetId);
    if (!cellsSheet) throw new Error('Expected to find cellsSheet in adjustHeadings');
    cellsSheet.adjustHeadings({ delta, row, column });
  }

  getCellsContentMaxWidth(column: number): number {
    if (!this.current) throw new Error('Expected current to be defined in CellsSheets.getCellsContentMaxWidth');
    return this.current.getCellsContentMaxWidth(column);
  }

  operations(operations: OperationSummary[]): void {
    operations.forEach((op) => {
      // need to convert to any to work through the operation type (not ideal)
      const operation = op as any;
      if (operation.setCellValues) {
        const cellsSheet = this.getById(operation.setCellValues[0]);
        if (!cellsSheet) throw new Error('Expected to find cellsSheet in cellsSheets.operations');
        cellsSheet.updateCells(operation.setCellValues[1]);
      } else if (operation.setCellFormats) {
        const cellsSheet = this.getById(operation.setCellFormats[0]);
        if (!cellsSheet) throw new Error('Expected to find cellsSheet in cellsSheets.operations');
        cellsSheet.updateCells(operation.setCellFormats[1]);
      }
    });
  }

  updateCodeCells(codeCells: SheetId[]): void {
    this.children.forEach((cellsSheet) => {
      if (codeCells.find((id) => id.id === cellsSheet.sheet.id)) {
        cellsSheet.updateCellsArray();
      }
    });
  }

  updateBorders(borderSheets: SheetId[]): void {
    this.children.forEach((cellsSheet) => {
      if (borderSheets.find((id) => id.id === cellsSheet.sheet.id)) {
        cellsSheet.createBorders();
      }
    });
  }
}
