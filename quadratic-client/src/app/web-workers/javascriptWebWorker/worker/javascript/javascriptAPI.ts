// This has the Javascript API functions. Internally, we only need getCells, as
// most of the other functions are derivatives of getCells. We hardcode the
// (x,y) position with the code, so `pos()` and `relCell()` can be calculated
// within the worker using getCells.

import type { JsGetCellResponse } from '@/app/quadratic-core-types';
import type { Javascript } from '@/app/web-workers/javascriptWebWorker/worker/javascript/javascript';
import { javascriptClient } from '@/app/web-workers/javascriptWebWorker/worker/javascriptClient';
import { javascriptCore } from '@/app/web-workers/javascriptWebWorker/worker/javascriptCore';

export type CellType = number | string | boolean | Date | undefined;
export type CellPos = { x: number; y: number };

export class JavascriptAPI {
  javascript: Javascript;

  constructor(javascript: Javascript) {
    this.javascript = javascript;
  }

  private convertType(entry: JsGetCellResponse): CellType | undefined {
    if (entry.type_name === 'blank') return undefined;
    if (entry.type_name === 'date time' || entry.type_name === 'date')
      return `___date___${new Date(entry.value).getTime()}`;

    return entry.type_name === 'number' ? parseFloat(entry.value) : entry.value;
  }

  getCellsA1 = async (
    a1: string,
    lineNumber?: number
  ): Promise<{ cells: CellType[][]; two_dimensional: boolean } | undefined> => {
    if (!this.javascript.transactionId) {
      throw new Error('No transactionId in getCellsA1');
    }

    const results = await javascriptCore.sendGetCellsA1(this.javascript.transactionId, a1, lineNumber);

    // error was thrown while getting cells
    if (!results) {
      javascriptClient.sendState('ready');
      return undefined;
    }

    const cells: CellType[][] = [];
    const height = results.y + results.h;
    const width = results.x + results.w;

    for (let y = results.y; y < height; y++) {
      const row: CellType[] = [];

      for (let x = results.x; x < width; x++) {
        const entry = results.cells?.find((r) => Number(r.x) === x && Number(r.y) === y);
        const typed = entry ? this.convertType(entry) : undefined;
        row.push(typed);
      }

      cells.push(row);
    }

    return { cells, two_dimensional: results.two_dimensional };
  };
}
