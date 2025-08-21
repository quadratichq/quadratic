import { debugFlag } from '@/app/debugFlags/debugFlags';
import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { CellsSheet } from '@/app/gridGL/cells/CellsSheet';
import type { Content } from '@/app/gridGL/Content';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import type { SheetInfo } from '@/app/quadratic-core-types';
import type {
  RenderClientCellsTextHashClear,
  RenderClientFinalizeCellsTextHash,
  RenderClientLabelMeshEntry,
} from '@/app/web-workers/renderWebWorker/renderClientMessages';
import { renderWebWorker } from '@/app/web-workers/renderWebWorker/renderWebWorker';
import type { Rectangle } from 'pixi.js';
import { Container } from 'pixi.js';

export class CellsSheets extends Container<CellsSheet> {
  current?: CellsSheet;
  content: Content;

  constructor(content: Content) {
    super();
    this.content = content;
    events.on('addSheet', this.addSheet);
    events.on('deleteSheet', this.deleteSheet);
    events.on('showLabel', this.showLabel);
  }

  destroy() {
    events.off('addSheet', this.addSheet);
    events.off('deleteSheet', this.deleteSheet);
    events.off('showLabel', this.showLabel);
    super.destroy();
  }

  async create() {
    this.children.forEach((child) => child.destroy());
    this.removeChildren();
    for (const sheet of sheets.sheets) {
      const child = this.addChild(new CellsSheet(sheet.id));
      if (sheet.id === sheets.current) {
        this.current = child;
        this.content.changeHoverTableHeaders(this.current.tables.hoverTableHeaders);
      }
    }
    renderWebWorker.pixiIsReady(sheets.current, pixiApp.viewport.getVisibleBounds(), pixiApp.viewport.scale.x);
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

  // // used to render all cellsTextHashes to warm up the GPU
  // showAll(id: string) {
  //   this.children.forEach((child) => {
  //     if (child.sheetId === id) {
  //       if (this.current?.sheetId !== child?.sheetId) {
  //         this.current = child;
  //         child.show(pixiApp.viewport.getVisibleBounds());
  //         pixiApp.changeHoverTableHeaders(this.current.tables.hoverTableHeaders);
  //       }
  //     } else {
  //       child.hide();
  //     }
  //   });
  // }

  show(id: string): void {
    this.children.forEach((child) => {
      if (child.sheetId === id) {
        if (this.current?.sheetId !== child?.sheetId) {
          this.current = child;
          child.show(pixiApp.viewport.getVisibleBounds());
          pixiApp.changeHoverTableHeaders(this.current.tables.hoverTableHeaders);
        }
      } else {
        child.hide();
      }
    });
  }

  cull(bounds: Rectangle): void {
    // this is a hack to keep the viewport active when the AI view is active
    if (bounds.width === 0 || bounds.height === 0) return;

    if (!this.current) throw new Error('Expected current to be defined in CellsSheets');
    this.current.show(bounds);
  }

  getById(id: string): CellsSheet | undefined {
    return this.children.find((search) => search.sheetId === id);
  }

  cellsTextHashClear(message: RenderClientCellsTextHashClear) {
    const cellsSheet = this.getById(message.sheetId);
    if (!cellsSheet) {
      throw new Error('Expected to find cellsSheet in cellsTextHashClear');
    }
    cellsSheet.cellsLabels.clearCellsTextHash(message);
    if (debugFlag('debugShowCellsHashBoxes') && sheets.current === message.sheetId) {
      this.content.setDirty();
    }

    const sheet = sheets.getById(message.sheetId);
    if (!sheet) {
      throw new Error('Expected to find sheet in cellsTextHashClear');
    }
    const key = `${message.hashX},${message.hashY}`;
    sheet.gridOverflowLines.updateHash(key, message.overflowGridLines);

    events.emit('hashContentChanged', message.sheetId, message.hashX, message.hashY);
  }

  labelMeshEntry(message: RenderClientLabelMeshEntry) {
    const cellsSheet = this.getById(message.sheetId);
    if (!cellsSheet) {
      throw new Error('Expected to find cellsSheet in labelMeshEntry');
    }
    cellsSheet.cellsLabels.addLabelMeshEntry(message);
    if (sheets.sheet?.id === message.sheetId) {
      this.content.setDirty();
    }
  }

  toggleOutlines(off?: boolean): void {
    this.current?.toggleOutlines(off);
  }

  // adjust headings for all but the cellsTextHash that changes
  adjustHeadings(options: { sheetId: string; delta: number; row: number | null; column: number | null }): void {
    const { sheetId, delta, row, column } = options;
    const cellsSheet = this.getById(sheetId);
    if (!cellsSheet) throw new Error('Expected to find cellsSheet in adjustHeadings');
    cellsSheet.cellsLabels.adjustHeadings(column, row, delta);
    if (sheets.current === sheetId) {
      if (debugFlag('debugShowCellsHashBoxes')) {
        const sheet = this.getById(sheetId);
        sheet?.show(pixiApp.viewport.getVisibleBounds());
      }
      this.content.setDirty({ gridLines: true, headings: true, cursor: true });
    }
  }

  getCellsContentMaxWidth(column: number): Promise<number> {
    if (!this.current) throw new Error('Expected current to be defined in CellsSheets.getCellsContentMaxWidth');
    return this.current.cellsLabels.getCellsContentMaxWidth(column);
  }

  getCellsContentMaxHeight(row: number): Promise<number> {
    if (!this.current) throw new Error('Expected current to be defined in CellsSheets.getCellsContentMaxHeight');
    return this.current.cellsLabels.getCellsContentMaxHeight(row);
  }

  adjustOffsetsBorders(sheetId: string): void {
    const cellsSheet = this.getById(sheetId);
    cellsSheet?.adjustOffsets();
  }

  adjustCellsImages(sheetId: string): void {
    const cellsSheet = this.getById(sheetId);
    cellsSheet?.cellsImages.reposition(sheetId);
  }

  private showLabel = (x: number, y: number, sheetId: string, show: boolean) => {
    const cellsSheet = this.getById(sheetId);
    cellsSheet?.showLabel(x, y, show);
  };

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
      cellsSheet.cellsLabels.finalizeCellsTextHash(message.hashX, message.hashY, message.special);
    }
  }

  isCursorOnCodeCellOutput(): boolean {
    const cellsSheet = this.current;
    if (!cellsSheet) return false;
    const cursor = sheets.sheet.cursor.position;
    return cellsSheet.tables.isTableAnchor(cursor.x, cursor.y);
  }

  update = (dirtyViewport: boolean) => {
    this.current?.update(dirtyViewport);
  };
}
