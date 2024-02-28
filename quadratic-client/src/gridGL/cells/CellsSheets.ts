import { events } from '@/events/events';
import { CellSheetsModified, JsRenderFill, SheetId } from '@/quadratic-core-types';
import {
  RenderClientCellsTextHashClear,
  RenderClientLabelMeshEntry,
} from '@/web-workers/renderWebWorker/renderClientMessages';
import { renderWebWorker } from '@/web-workers/renderWebWorker/renderWebWorker';
import { Container, Rectangle } from 'pixi.js';
import { sheets } from '../../grid/controller/Sheets';
import { pixiApp } from '../pixiApp/PixiApp';
import { CellsSheet } from './CellsSheet';

export class CellsSheets extends Container<CellsSheet> {
  current?: CellsSheet;

  constructor() {
    super();
    events.on('sheetInfo', this.create);
    events.on('sheetFills', this.updateFills);
  }

  create = async () => {
    this.removeChildren();
    if (!sheets.size) return;

    for (const sheet of sheets.sheets) {
      const child = this.addChild(new CellsSheet(sheet));
      await child.preload();
      if (sheet.id === sheets.sheet.id) {
        this.current = child;
      }
    }
    renderWebWorker.pixiIsReady(sheets.sheet.id, pixiApp.viewport.getVisibleBounds());
  };

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

  // used to render all cellsTextHashes to warm up the GPU
  showAll(id: string) {
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

  cellsTextHashClear(message: RenderClientCellsTextHashClear) {
    const cellsSheet = this.getById(message.sheetId);
    if (!cellsSheet) {
      throw new Error('Expected to find cellsSheet in cellsTextHashClear');
    }
    cellsSheet.cellsLabels.clearCellsTextHash(message);
    pixiApp.setViewportDirty();
  }

  labelMeshEntry(message: RenderClientLabelMeshEntry) {
    const cellsSheet = this.getById(message.sheetId);
    if (!cellsSheet) {
      throw new Error('Expected to find cellsSheet in labelMeshEntry');
    }
    cellsSheet.cellsLabels.addLabelMeshEntry(message);
  }

  toggleOutlines(off?: boolean): void {
    this.current?.toggleOutlines(off);
  }

  createBorders(): void {
    this.current?.createBorders();
  }

  updateFills = (sheetId: string, fills: JsRenderFill[]) => {
    const cellsSheet = this.getById(sheetId);
    if (!cellsSheet) throw new Error('Expected sheet to be defined in CellsSheets.updateFills');
    cellsSheet.updateFills(fills);
    if (cellsSheet.sheet.id === sheets.sheet.id) {
      pixiApp.setViewportDirty();
    }
  };

  // adjust headings without recalculating the glyph geometries
  adjustHeadings(options: { sheetId: string; delta: number; row?: number; column?: number }): void {
    const { sheetId, delta, row, column } = options;
    const cellsSheet = this.getById(sheetId);
    if (!cellsSheet) throw new Error('Expected to find cellsSheet in adjustHeadings');
    cellsSheet.cellsLabels.adjustHeadings({ delta, row, column });
    if (sheets.sheet.id === sheetId) {
      pixiApp.gridLines.dirty = true;
      pixiApp.cursor.dirty = true;
      pixiApp.headings.dirty = true;
    }
  }

  getCellsContentMaxWidth(column: number): number {
    if (!this.current) throw new Error('Expected current to be defined in CellsSheets.getCellsContentMaxWidth');
    return this.current.cellsLabels.getCellsContentMaxWidth(column);
  }

  modified(cellSheetsModified: CellSheetsModified[]): void {
    for (const cellSheet of this.children) {
      const modified = cellSheetsModified.filter((modified) => modified.sheet_id === cellSheet.sheet.id);
      if (modified.length) {
        cellSheet.updateCellsArray();
        cellSheet.cellsLabels.modified(modified);
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

  unload(options: { sheetId: string; hashX: number; hashY: number }): void {
    const { sheetId, hashX, hashY } = options;
    const cellsSheet = this.getById(sheetId);
    if (cellsSheet) {
      cellsSheet.unload(hashX, hashY);
    }
  }
}
