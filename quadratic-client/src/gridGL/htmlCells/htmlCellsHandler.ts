import { grid } from '@/grid/controller/Grid';
import { sheets } from '@/grid/controller/Sheets';
import { JsHtmlOutput } from '@/quadratic-core/types';
import { HtmlCell } from './HtmlCell';

class HTMLCellsHandler {
  private cells: Set<HtmlCell> = new Set();

  // used to attach the html-cells to react
  private div?: HTMLDivElement;

  attach(parent: HTMLDivElement) {
    if (this.div) {
      parent.appendChild(this.div);
    }
  }

  init(parent: HTMLDivElement | null) {
    this.div = this.div ?? document.createElement('div');
    this.div.className = 'html-cells';
    this.updateHtmlCells();
    window.addEventListener('change-sheet', this.changeSheet);
    window.addEventListener('html-update', this.updateHtmlCellsBySheetId);
    if (parent) {
      this.attach(parent);
    }
  }

  destroy() {
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

  // handle changes to offsets
  updateOffsets(sheetIds: string[]) {
    this.cells.forEach((cell) => {
      if (sheetIds.includes(cell.sheet.id)) cell.updateOffsets();
    });
  }
}

export const htmlCellsHandler = new HTMLCellsHandler();
