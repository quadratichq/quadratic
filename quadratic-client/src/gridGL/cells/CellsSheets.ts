import { Container, Rectangle } from 'pixi.js';
import { sheets } from '../../grid/controller/Sheets';
import { CellSheetsModified, SheetId } from '../../quadratic-core/types';
import { pixiApp } from '../pixiApp/PixiApp';
import { CellsSheet } from './CellsSheet';

export class CellsSheets extends Container<CellsSheet> {
  current?: CellsSheet;

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

  // this updates the first dirty CellsSheet, always starting with the current sheet
  update(): void {
    if (!this.current) throw new Error('Expected current to be defined in CellsSheets');
    if (this.current.update()) {
      pixiApp.setViewportDirty();
      return;
    }
    for (const child of this.children) {
      if (this.current !== child) {
        if (child.update()) {
          pixiApp.setViewportDirty();
          return;
        }
      }
    }
  }

  toggleOutlines(off?: boolean): void {
    this.current?.toggleOutlines(off);
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
    if (sheets.sheet.id === sheetId) {
      pixiApp.gridLines.dirty = true;
      pixiApp.cursor.dirty = true;
      pixiApp.headings.dirty = true;
    }
  }

  getCellsContentMaxWidth(column: number): number {
    if (!this.current) throw new Error('Expected current to be defined in CellsSheets.getCellsContentMaxWidth');
    return this.current.getCellsContentMaxWidth(column);
  }

  modified(cellSheetsModified: CellSheetsModified[]): void {
    for (const cellSheet of this.children) {
      const modified = cellSheetsModified.filter((modified) => modified.sheet_id === cellSheet.sheet.id);
      if (modified.length) {
        cellSheet.updateCellsArray();
        cellSheet.modified(modified);
      }
    }
  }

  updateCodeCells(codeCells: SheetId[]): void {
    this.children.forEach((cellsSheet) => {
      if (codeCells.find((id) => id.id === cellsSheet.sheet.id)) {
        cellsSheet.updateCellsArray();
        if (sheets.sheet.id === cellsSheet.sheet.id) {
          window.dispatchEvent(new CustomEvent('python-computation-complete'));
        }
      }
    });
  }

  updateCellsArray(): void {
    if (!this.current) throw new Error('Expected current to be defined in CellsSheets.updateCellsArray');
    this.current.updateCellsArray();
  }

  updateBorders(borderSheets: SheetId[]): void {
    this.children.forEach((cellsSheet) => {
      if (borderSheets.find((id) => id.id === cellsSheet.sheet.id)) {
        cellsSheet.createBorders();
      }
    });
  }

  updateBordersString(borderSheets: String[]): void {
    this.children.forEach((cellsSheet) => {
      if (borderSheets.find((id) => id === cellsSheet.sheet.id)) {
        cellsSheet.createBorders();
      }
    });
  }

  showLabel(x: number, y: number, sheetId: string, show: boolean) {
    const cellsSheet = this.getById(sheetId);
    if (!cellsSheet) throw new Error('Expected to find cellsSheet in showLabel');
    cellsSheet.showLabel(x, y, show);
  }
}
