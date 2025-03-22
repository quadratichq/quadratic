// This has the Javascript API functions. Internally, we only need getCells, as
// most of the other functions are derivatives of getCells. We hardcode the
// (x,y) position with the code, so `pos()` and `relCell()` can be calculated
// within the worker using getCells.

import type { JsCellsA1Response } from '@/app/quadratic-core-types';
import type { Javascript } from '@/app/web-workers/javascriptWebWorker/worker/javascript/javascript';
import { javascriptCore } from '@/app/web-workers/javascriptWebWorker/worker/javascriptCore';

export class JavascriptAPI {
  javascript: Javascript;

  constructor(javascript: Javascript) {
    this.javascript = javascript;
  }

  getCellsA1 = async (a1: string): Promise<ArrayBuffer> => {
    if (!this.javascript.transactionId) {
      throw new Error('No transactionId in getCellsA1');
    }

    let responseBuffer: ArrayBuffer;
    try {
      responseBuffer = await javascriptCore.sendGetCellsA1(this.javascript.transactionId, a1);
    } catch (error: any) {
      const response: JsCellsA1Response = {
        values: null,
        error: {
          core_error: `Failed to parse getCellsA1 response: ${error}`,
        },
      };
      const responseString = JSON.stringify(response);
      const encoder = new TextEncoder();
      const responseUint8Array = encoder.encode(responseString);
      responseBuffer = responseUint8Array.buffer as ArrayBuffer;
    }

    return responseBuffer;
  };
}
