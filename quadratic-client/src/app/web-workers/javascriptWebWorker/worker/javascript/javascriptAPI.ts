// This has the Javascript API functions. Internally, we only need getCells, as
// most of the other functions are derivatives of getCells. We hardcode the
// (x,y) position with the code, so `pos()` and `relCell()` can be calculated
// within the worker using getCells.

import type { JsCellA1Response, JsCellA1Value } from '@/app/quadratic-core-types';
import type { Javascript } from '@/app/web-workers/javascriptWebWorker/worker/javascript/javascript';
import { javascriptCore } from '@/app/web-workers/javascriptWebWorker/worker/javascriptCore';

export type CellType = number | string | boolean | Date | undefined;

export class JavascriptAPI {
  javascript: Javascript;

  constructor(javascript: Javascript) {
    this.javascript = javascript;
  }

  private convertType(entry: JsCellA1Value): CellType | undefined {
    if (entry.type_name === 'blank') return undefined;
    if (entry.type_name === 'date time' || entry.type_name === 'date')
      return `___date___${new Date(entry.value).getTime()}`;

    return entry.type_name === 'number' ? parseFloat(entry.value) : entry.value;
  }

  getCellsA1 = async (
    a1: string
  ): Promise<{
    values: { cells: CellType[][] | CellType; one_dimensional: boolean; two_dimensional: boolean } | null;
    error: string | null;
  }> => {
    if (!this.javascript.transactionId) {
      throw new Error('No transactionId in getCellsA1');
    }

    const results = await javascriptCore.sendGetCellsA1(this.javascript.transactionId, a1);

    let response: JsCellA1Response | undefined;
    try {
      response = JSON.parse(results);
    } catch (error) {
      response = {
        values: null,
        error: {
          core_error: `Failed to parse getCellsA1 response: ${error}`,
        },
      };
    }
    if (!response || !response.values || response.error) {
      return { values: null, error: response?.error?.core_error ?? 'Failed to get cells' };
    }

    const cells: CellType[][] = [];
    const height = response.values.y + response.values.h;
    const width = response.values.x + response.values.w;

    for (let y = response.values.y; y < height; y++) {
      const row: CellType[] = [];

      for (let x = response.values.x; x < width; x++) {
        const entry = response.values.cells?.find((r) => Number(r.x) === x && Number(r.y) === y);
        const typed = entry ? this.convertType(entry) : undefined;
        row.push(typed);
      }

      cells.push(row);
    }

    return {
      values: {
        cells,
        one_dimensional: response.values.one_dimensional,
        two_dimensional: response.values.two_dimensional,
      },
      error: null,
    };
  };
}
