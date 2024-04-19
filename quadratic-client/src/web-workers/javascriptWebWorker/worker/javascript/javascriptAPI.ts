import { JsGetCellResponse } from '@/quadratic-core-types';
import { javascriptClient } from '../javascriptClient';
import { javascriptCore } from '../javascriptCore';
import { Javascript } from './javascript';

export type CellType = number | string | undefined;
export type CellPos = { x: number; y: number };

export class JavascriptAPI {
  javascript: Javascript;

  constructor(javascript: Javascript) {
    this.javascript = javascript;
  }

  private convertType(entry: JsGetCellResponse): CellType {
    return entry.type_name === 'number' ? parseFloat(entry.value) : entry.value;
  }

  getCells = async (
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    sheet?: string,
    lineNumber?: number
  ): Promise<CellType[][] | undefined> => {
    if (!this.javascript.transactionId) {
      throw new Error('No transactionId in getCells');
    }
    const results = await javascriptCore.sendGetCells(
      this.javascript.transactionId,
      x0,
      y0,
      x1 - x0 + 1,
      y1 - y0 + 1,
      sheet,
      lineNumber
    );

    // error was thrown while getting cells (probably SheetName was not available)
    if (!results) {
      javascriptClient.sendState('ready');
      return undefined;
    }

    const cells: CellType[][] = [];
    for (let y = y0; y <= y1; y++) {
      const row: any[] = [];
      for (let x = x0; x <= x1; x++) {
        const entry = results.find((r) => Number(r.x) === x && Number(r.y) === y);
        if (entry) {
          const typed = this.convertType(entry);
          row.push(typed);
        } else {
          row.push(undefined);
        }
      }
      cells.push(row);
    }

    return cells;
  };
}
