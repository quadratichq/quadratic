import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { JsHtmlOutput } from '@/app/quadratic-core-types';
import { HtmlCell } from './HtmlCell';

class HTMLCellsHandler {
  private cells: Set<HtmlCell> = new Set();

  // used to attach the html-cells to react
  private div?: HTMLDivElement;

  // used to hold the data if the div is not yet created
  private dataWaitingForDiv?: JsHtmlOutput[];

  constructor() {
    events.on('htmlOutput', this.htmlOutput);
    events.on('htmlUpdate', this.htmlUpdate);
    events.on('changeSheet', this.changeSheet);
    events.on('sheetOffsets', (sheetId) => this.updateOffsets([sheetId]));
    events.on('resizeRowHeights', (sheetId) => this.updateOffsets([sheetId]));
  }

  private htmlOutput = (data: JsHtmlOutput[]) => {
    if (this.div) {
      this.updateHtmlCells(data);
    } else {
      this.dataWaitingForDiv = data;
    }
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

  attach(parent: HTMLDivElement) {
    if (this.div) {
      parent.appendChild(this.div);
    }
  }

  init(parent: HTMLDivElement | null) {
    this.div = this.div ?? document.createElement('div');
    this.div.className = 'html-cells';
    if (parent) {
      this.attach(parent);
    }
    if (this.dataWaitingForDiv) {
      this.updateHtmlCells(this.dataWaitingForDiv);
      this.dataWaitingForDiv = undefined;
    }
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

  updateHtmlCells(htmlCells: JsHtmlOutput[]) {
    this.prepareCells([...this.cells], htmlCells);
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
