import { grid } from '@/grid/controller/Grid';
import { sheets } from '@/grid/controller/Sheets';
import { JsHtmlOutput } from '@/quadratic-core/types';
import { pixiApp } from '../pixiApp/PixiApp';
import { HtmlCell } from './HtmlCell';

class HTMLCellsHandler {
  private cells: Set<HtmlCell> = new Set();

  // used to attach the html-cells to react
  private div?: HTMLDivElement;

  private handleViewport = () => {
    const parent = this.getParent();
    if (!parent) {
      throw new Error('Expected to find .html-cells in htmlCells.ts');
    }
    const viewport = pixiApp.viewport;
    viewport.updateTransform();
    const worldTransform = viewport.worldTransform;
    parent.style.transform = `matrix(${worldTransform.a},${worldTransform.b},${worldTransform.c},${worldTransform.d},${worldTransform.tx},${worldTransform.ty})`;
  };

  attach(parent: HTMLDivElement) {
    console.log(1);
    if (this.div) {
      console.log(2);
      parent.appendChild(this.div);
    }
  }

  init(parent: HTMLDivElement | null) {
    this.div = document.createElement('div');
    this.div.className = 'html-cells';
    this.updateHtmlCells();
    this.handleViewport();
    pixiApp.viewport.on('moved', this.handleViewport);
    pixiApp.viewport.on('moved-end', this.handleViewport);
    pixiApp.viewport.on('zoomed', this.handleViewport);
    window.addEventListener('change-sheet', this.changeSheet);
    window.addEventListener('html-update', this.updateHtmlCellsBySheetId);
    if (parent) {
      this.attach(parent);
    }
  }

  destroy() {
    pixiApp.viewport.off('moved', this.handleViewport);
    pixiApp.viewport.off('moved-end', this.handleViewport);
    pixiApp.viewport.on('zoomed', this.handleViewport);
    window.removeEventListener('change-sheet', this.changeSheet);
    window.removeEventListener('html-update', this.updateHtmlCellsBySheetId);
  }

  private changeSheet = () => {
    this.cells.forEach((cell) => cell.changeSheet(sheets.sheet.id));
  };

  private getParent(): HTMLDivElement {
    if (!this.div) {
      throw new Error('Expected to find this.div in htmlCells.ts');
    }
    return this.div;
  }

  private prepareCells(old: HtmlCell[], cells: JsHtmlOutput[]) {
    const parent = this.getParent();

    // update or add new cells
    cells.forEach((htmlCell) => {
      const index = old.findIndex((cell) => cell.isOutputEqual(htmlCell));
      if (index === -1) {
        const cell = new HtmlCell(htmlCell);
        parent.appendChild(cell.div);
        this.cells.add(cell);
      } else {
        old[index].update(htmlCell);
        old.splice(index, 1);
      }
    });

    // remove old cells
    old.forEach((cell) => {
      parent.removeChild(cell.div);
      this.cells.delete(cell);
    });
  }

  private updateHtmlCellsBySheetId = (e: any /*{ detail: { id: string }[] }*/) => {
    const old: HtmlCell[] = [];
    const cells = e.detail.flatMap((sheet: { id: string }) => {
      old.push(...Array.from(this.cells.values()).filter((cell) => cell.isSheet(sheet.id)));
      return grid.getHtmlOutput(sheet.id);
    });
    this.prepareCells(old, cells);
  };

  private updateHtmlCells() {
    const cells = sheets.sheets.flatMap((sheet) => [...grid.getHtmlOutput(sheet.id)]);
    this.prepareCells([...this.cells], cells);
  }

  clearHighlightEdges() {
    this.cells.forEach((cell) => cell.clearHighlightEdges());
  }

  getCells(): HtmlCell[] {
    return Array.from(this.cells.values());
  }
}

export const htmlCellsHandler = new HTMLCellsHandler();
