import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { JsHtmlOutput } from '@/app/quadratic-core-types';
import { HtmlCell } from './HtmlCell';

class HTMLCellsHandler {
  // used to attach the html-cells to react
  private div: HTMLDivElement;

  private cells: Set<HtmlCell> = new Set();

  constructor() {
    this.div = document.createElement('div');
    this.div.className = 'html-cells';

    events.on('htmlOutput', this.htmlOutput);
    events.on('htmlUpdate', this.htmlUpdate);
    events.on('changeSheet', this.changeSheet);
    events.on('sheetOffsets', (sheetId) => this.updateOffsets([sheetId]));
    events.on('resizeRowHeights', (sheetId) => this.updateOffsets([sheetId]));
  }

  attach = (parent: HTMLDivElement) => {
    parent.appendChild(this.div);
  };

  private htmlOutput = (htmlCells: JsHtmlOutput[]) => {
    this.prepareCells([...this.cells], htmlCells);
  };

  private htmlUpdate = (data: JsHtmlOutput) => {
    // update an existing cell
    for (const cell of this.cells) {
      if (cell.isOutputEqual(data)) {
        if (data.html) {
          cell.update(data);
        } else {
          this.getParent().removeChild(cell.div);
          this.cells.delete(cell);
        }
        return;
      }
    }

    // or add a new cell
    if (data.html) {
      const cell = new HtmlCell(data);
      this.getParent().appendChild(cell.div);
      this.cells.add(cell);
    }
  };

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

  clearHighlightEdges() {
    this.cells.forEach((cell) => cell.clearHighlightEdges());
  }

  // cells are store in back to front order
  // return cells in front to back order
  getCells(): HtmlCell[] {
    return Array.from(this.cells.values()).reverse();
  }

  // handle changes to offsets
  updateOffsets(sheetIds: string[]) {
    this.cells.forEach((cell) => {
      if (sheetIds.includes(cell.sheet.id)) cell.updateOffsets();
    });
  }

  // moves the chart to top
  // updates the z-index and the order of the cells
  movetoTop(cell: HtmlCell) {
    const cells = this.getCells();
    if (cells.length < 2) return;
    const topCell = cells[0];
    if (topCell === cell) return;
    const topCellZIndex = parseInt(topCell.div.style.zIndex || '0');
    cell.div.style.zIndex = (topCellZIndex + 1).toString();
    // remove and add cell to the set to update the order
    this.cells.delete(cell);
    this.cells.add(cell);
  }
}

export const htmlCellsHandler = new HTMLCellsHandler();
