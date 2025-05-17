// This has the Javascript API functions. Internally, we only need getCells, as
// most of the other functions are derivatives of getCells. We hardcode the
// (x,y) position with the code, so `pos()` and `relCell()` can be calculated
// within the worker using getCells.

import type { JsCellsA1Response } from '@/app/quadratic-core-types';
import { toUint8Array } from '@/app/shared/utils/Uint8Array';
import type { Javascript } from '@/app/web-workers/javascriptWebWorker/worker/javascript/javascript';
import { javascriptCore } from '@/app/web-workers/javascriptWebWorker/worker/javascriptCore';

export class JavascriptAPI {
  javascript: Javascript;

  constructor(javascript: Javascript) {
    this.javascript = javascript;
  }

  getCellsA1 = async (transactionId: string, a1: string): Promise<ArrayBuffer> => {
    let responseBuffer: ArrayBuffer;
    try {
      responseBuffer = await javascriptCore.sendGetCellsA1(transactionId, a1);
    } catch (error: any) {
      const response: JsCellsA1Response = {
        values: null,
        error: {
          core_error: `Failed to parse getCellsA1 response: ${error}`,
        },
      };
      const responseUint8Array = toUint8Array(response);
      responseBuffer = responseUint8Array.buffer as ArrayBuffer;
    }

    return responseBuffer;
  };
}
