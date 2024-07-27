import { Container } from 'pixi.js';
import type { Rectangle } from 'pixi.js';

import { debugShowCellsHashBoxes } from '@/app/debugFlags';
import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { CellsSheet } from '@/app/gridGL/cells/CellsSheet';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import type { SheetInfo } from '@/app/quadratic-core-types';
import type {
  RenderClientCellsTextHashClear,
  RenderClientFinalizeCellsTextHash,
  RenderClientLabelMeshEntry,
} from '@/app/web-workers/renderWebWorker/renderClientMessages';
import { renderWebWorker } from '@/app/web-workers/renderWebWorker/renderWebWorker';

export class CellsSheets extends Container<CellsSheet> {
  current?: CellsSheet;

  constructor() {
    super();
    events.on('addSheet', this.addSheet);
    events.on('deleteSheet', this.deleteSheet);
  }

  async create() {
    this.removeChildren();
    for (const sheet of sheets.sheets) {
      const child = this.addChild(new CellsSheet(sheet.id));
      if (sheet.id === sheets.sheet.id) {
        this.current = child;
      }
    }
    renderWebWorker.pixiIsReady(sheets.sheet.id, pixiApp.viewport.getVisibleBounds());
  }

  isReady(): boolean {
    return !!this.current;
  }

  private addSheet = (sheetInfo: SheetInfo) => {
    this.addChild(new CellsSheet(sheetInfo.sheet_id));
  };

  private deleteSheet = (sheetId: string) => {
    const cellsSheet = this.children.find((cellsSheet) => cellsSheet.sheetId === sheetId);
    if (!cellsSheet) throw new Error('Expected to find cellsSheet in CellSheets.delete');
    this.removeChild(cellsSheet);
    cellsSheet.destroy();
  };

  // used to render all cellsTextHashes to warm up the GPU
  showAll(id: string) {
    this.children.forEach((child) => {
      if (child.sheetId === id) {
        if (this.current?.sheetId !== child?.sheetId) {
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
      if (child.sheetId === id) {
        if (this.current?.sheetId !== child?.sheetId) {
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
    return this.children.find((search) => search.sheetId === id);
  }

  cellsTextHashClear(message: RenderClientCellsTextHashClear) {
    const cellsSheet = this.getById(message.sheetId);
    if (!cellsSheet) {
      throw new Error('Expected to find cellsSheet in cellsTextHashClear');
    }
    cellsSheet.cellsLabels.clearCellsTextHash(message);
    if (debugShowCellsHashBoxes && sheets.sheet.id === message.sheetId) {
      pixiApp.setViewportDirty();
    }
  }

  labelMeshEntry(message: RenderClientLabelMeshEntry) {
    const cellsSheet = this.getById(message.sheetId);
    if (!cellsSheet) {
      throw new Error('Expected to find cellsSheet in labelMeshEntry');
    }
    cellsSheet.cellsLabels.addLabelMeshEntry(message);
    if (sheets.sheet?.id === message.sheetId) {
      pixiApp.setViewportDirty();
    }
  }

  toggleOutlines(off?: boolean): void {
    this.current?.toggleOutlines(off);
  }

  // adjust headings for all but the cellsTextHash that changes
  adjustHeadings(options: { sheetId: string; delta: number; row?: number; column?: number }): void {
    const { sheetId, delta, row, column } = options;
    const cellsSheet = this.getById(sheetId);
    if (!cellsSheet) throw new Error('Expected to find cellsSheet in adjustHeadings');
    cellsSheet.cellsLabels.adjustHeadings(column, row, delta);
    if (sheets.sheet.id === sheetId) {
      if (debugShowCellsHashBoxes) {
        const sheet = this.getById(sheetId);
        sheet?.show(pixiApp.viewport.getVisibleBounds());
      }
      pixiApp.gridLines.dirty = true;
      pixiApp.cursor.dirty = true;
      pixiApp.headings.dirty = true;
      this.updateCellsArray();
    }
  }

  async getCellsContentMaxWidth(column: number): Promise<number> {
    if (!this.current) throw new Error('Expected current to be defined in CellsSheets.getCellsContentMaxWidth');
    return this.current.cellsLabels.getCellsContentMaxWidth(column);
  }

  updateCellsArray(): void {
    if (!this.current) throw new Error('Expected current to be defined in CellsSheets.updateCellsArray');
    this.current.updateCellsArray();
  }

  adjustOffsetsBorders(sheetId: string): void {
    const cellsSheet = this.getById(sheetId);
    cellsSheet?.adjustOffsets();
  }

  showLabel(x: number, y: number, sheetId: string, show: boolean) {
    const cellsSheet = this.getById(sheetId);
    cellsSheet?.showLabel(x, y, show);
  }

  unload(options: { sheetId: string; hashX: number; hashY: number }): void {
    const { sheetId, hashX, hashY } = options;
    const cellsSheet = this.getById(sheetId);
    if (cellsSheet) {
      cellsSheet.unload(hashX, hashY);
    }
  }

  finalizeCellsTextHash(message: RenderClientFinalizeCellsTextHash) {
    const cellsSheet = this.getById(message.sheetId);
    if (cellsSheet) {
      cellsSheet.cellsLabels.finalizeCellsTextHash(message.hashX, message.hashY);
    }
  }

  isCursorOnCodeCell(): boolean {
    const cellsSheet = this.current;
    if (!cellsSheet) return false;
    const cursor = sheets.sheet.cursor.cursorPosition;
    return cellsSheet.cellsArray.isCodeCell(cursor.x, cursor.y);
  }

  update() {
    this.current?.update();
  }
}
