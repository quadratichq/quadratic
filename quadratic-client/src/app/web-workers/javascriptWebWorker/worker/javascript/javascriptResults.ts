// Converts

import type { JsCellValueResult, JsCodeResult } from '@/app/quadratic-core-types';
import { toUint8Array } from '@/app/shared/utils/Uint8Array';
import {
  javascriptConvertOutputArray,
  javascriptConvertOutputType,
} from '@/app/web-workers/javascriptWebWorker/worker/javascript/javascriptOutput';
import { javascriptClient } from '@/app/web-workers/javascriptWebWorker/worker/javascriptClient';
import { javascriptCore } from '@/app/web-workers/javascriptWebWorker/worker/javascriptCore';

export function javascriptErrorResult(transactionId: string, message: string, lineNumber?: number) {
  const codeResult: JsCodeResult = {
    transaction_id: transactionId,
    success: false,
    output_value: null,
    std_err: message ?? 'An error occurred running the code in the cell.',
    std_out: '',
    output_array: null,
    line_number: lineNumber ?? null,
    output_display_type: null,
    chart_pixel_output: null,
    chart_image: null,
    has_headers: false,
  };

  const uint8Array = toUint8Array(codeResult);
  javascriptCore.sendJavascriptResults(transactionId, uint8Array.buffer as ArrayBuffer);
  javascriptClient.sendState('ready');
}

export function javascriptResults(
  transactionId: string,
  x: number,
  y: number,
  result: any,
  consoleOutput: string,
  lineNumber?: number,
  chartPixelOutput?: [number, number]
) {
  const message: string[] = [];
  const outputType = javascriptConvertOutputType(message, result, x, y);
  const outputArray = javascriptConvertOutputArray(message, result, x, y);
  const codeResult: JsCodeResult = {
    transaction_id: transactionId,
    success: true,
    output_value: outputType?.output ? (outputType.output as any as JsCellValueResult) : null,
    std_out: (consoleOutput ? consoleOutput : '') + (message.length ? message.join('\n') : ''),
    std_err: null,
    output_array: outputArray ? (outputArray.output as any as JsCellValueResult[][]) : null,

    // lineNumber is tricky because of the hacky way we count it. A return on line 0
    // will never increment the line number, which is why we have to increment it.
    line_number: lineNumber !== undefined ? (lineNumber === 0 ? 1 : lineNumber) : null,

    output_display_type: outputType?.displayType || outputArray?.displayType || null,
    chart_pixel_output: chartPixelOutput || null,
    chart_image: null,

    has_headers: false,
  };
  const uint8Array = toUint8Array(codeResult);
  javascriptCore.sendJavascriptResults(transactionId, uint8Array.buffer as ArrayBuffer);
  // Note: awaitingExecution will be sent by next() method after this function returns
  javascriptClient.sendState('ready');
}
