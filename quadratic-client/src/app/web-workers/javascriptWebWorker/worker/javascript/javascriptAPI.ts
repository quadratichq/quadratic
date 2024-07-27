// This has the Javascript API functions. Internally, we only need getCells, as
// most of the other functions are derivatives of getCells. We hardcode the
// (x,y) position with the code, so `pos()` and `relCell()` can be calculated
// within the worker using getCells.

import type { JsGetCellResponse } from '@/app/quadratic-core-types';
import type { Javascript } from '@/app/web-workers/javascriptWebWorker/worker/javascript/javascript';
import { javascriptClient } from '@/app/web-workers/javascriptWebWorker/worker/javascriptClient';
import { javascriptCore } from '@/app/web-workers/javascriptWebWorker/worker/javascriptCore';

export type CellType = number | string | boolean | undefined;
export type CellPos = { x: number; y: number };

export class JavascriptAPI {
  javascript: Javascript;

  constructor(javascript: Javascript) {
    this.javascript = javascript;
  }

  private convertType(entry: JsGetCellResponse): CellType | undefined {
    if (entry.type_name === 'blank') return undefined;
    return entry.type_name === 'number' ? parseFloat(entry.value) : entry.value;
  }

  getCells = async (
    x0: number,
    y0: number,
    x1: number,
    y1?: number,
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
      y1 ? y1 - y0 + 1 : undefined,
      sheet,
      lineNumber
    );

    // error was thrown while getting cells (probably SheetName was not available)
    if (!results) {
      javascriptClient.sendState('ready');
      return undefined;
    }

    const cells: CellType[][] = [];
    // if the height is calculated, we take the larger of the y0 and the largest
    // y value returned
    if (!y1) {
      let largestY = -Infinity;
      results.forEach((r) => (largestY = Math.max(Number(r.y), largestY)));
      y1 = largestY === -Infinity ? y0 : largestY;
    }
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
