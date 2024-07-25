// Converts

import { JsCodeResult } from '@/app/quadratic-core-types';
import { javascriptClient } from '../javascriptClient';
import { javascriptCore } from '../javascriptCore';
import { javascriptConvertOutputArray, javascriptConvertOutputType } from './javascriptOutput';

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
    cancel_compute: false,
  };
  javascriptCore.sendJavascriptResults(transactionId, codeResult);
  javascriptClient.sendState('ready');
}

export function javascriptResults(
  transactionId: string,
  x: number,
  y: number,
  result: any,
  consoleOutput: string,
  lineNumber?: number
) {
  const message: string[] = [];
  const outputType = javascriptConvertOutputType(message, result, x, y);
  const outputArray = javascriptConvertOutputArray(message, result, x, y);
  const codeResult: JsCodeResult = {
    transaction_id: transactionId,
    success: true,
    output_value: outputType?.output ? outputType.output : null,
    std_out: (consoleOutput ? consoleOutput : '') + (message.length ? message.join('\n') : ''),
    std_err: null,
    output_array: outputArray ? outputArray.output : null,

    // lineNumber is tricky because of the hacky way we count it. A return on line 0
    // will never increment the line number, which is why we have to increment it.
    line_number: lineNumber !== undefined ? (lineNumber === 0 ? 1 : lineNumber) : null,

    output_display_type: outputType?.displayType || outputArray?.displayType || null,
    cancel_compute: false,
  };
  javascriptCore.sendJavascriptResults(transactionId, codeResult);
  javascriptClient.sendState('ready', { current: undefined });
}
