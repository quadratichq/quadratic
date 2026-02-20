import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { intersects } from '@/app/gridGL/helpers/intersects';
import { HtmlCell } from '@/app/gridGL/HTMLGrid/htmlCells/HtmlCell';
import type { JsCoordinate, JsHtmlOutput, JsRenderCodeCell } from '@/app/quadratic-core-types';
import type { Point } from 'pixi.js';
import { Rectangle } from 'pixi.js';

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
    events.on('sheetOffsetsUpdated', (sheetId) => this.updateOffsets([sheetId]));
  }

  attach = (parent: HTMLDivElement) => {
    parent.appendChild(this.div);
  };

  detach = () => {
    this.cells.clear();
    this.div.remove();
    this.div = document.createElement('div');
    this.div.className = 'html-cells';
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
          cell.destroy();
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
    this.cells.forEach((cell) => cell.changeSheet(sheets.current));
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
      cell.destroy();
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

  checkHover(world: Point): JsCoordinate | undefined {
    const cells = this.getCells();
    for (const cell of cells) {
      if (cell.sheet.id !== sheets.current) continue;
      const bounds = new Rectangle(
        cell.div.offsetLeft,
        cell.div.offsetTop,
        cell.div.offsetWidth,
        cell.div.offsetHeight
      );
      if (intersects.rectanglePoint(bounds, world)) {
        return { x: cell.x, y: cell.adjustedY };
      }
    }
  }

  // returns true if the cell is an html cell
  isHtmlCell(x: number, y: number): boolean {
    return this.getCells().some((cell) => cell.x === x && cell.adjustedY === y && cell.sheet.id === sheets.current);
  }

  // returns true if the Pos overlaps with the output of an html cell
  contains(x: number, y: number): boolean {
    return this.getCells().some((cell) => cell.contains(x, y));
  }

  findCodeCell = (sheet_id: string, x: number, y: number): HtmlCell | undefined => {
    return this.getCells().find((cell) => cell.sheet.id === sheet_id && cell.contains(x, y));
  };

  codeCellPixelWidth = (sheet_id: string, x: number, y: number): number | undefined => {
    const cell = this.findCodeCell(sheet_id, x, y);
    if (cell) {
      return cell.width;
    }
  };

  showActive(codeCell: JsRenderCodeCell) {
    const cell = this.getCells().find(
      (cell) => cell.x === codeCell.x && cell.y === codeCell.y && cell.sheet.id === sheets.current
    );
    cell?.activate();
  }

  hideActive(codeCell: JsRenderCodeCell) {
    const cell = this.getCells().find(
      (cell) => cell.x === codeCell.x && cell.y === codeCell.y && cell.sheet.id === sheets.current
    );
    cell?.deactivate();
  }

  disable() {
    this.getCells().forEach((cell) => cell.deactivate());
  }

  temporarilyDisable() {
    this.getCells().forEach((cell) => cell.temporarilyDeactivate());
  }

  enable() {
    this.getCells().forEach((cell) => cell.reactivate());
  }
}

export const htmlCellsHandler = new HTMLCellsHandler();
