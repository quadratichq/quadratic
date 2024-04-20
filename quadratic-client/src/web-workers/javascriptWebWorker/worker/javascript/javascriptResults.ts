import { JsCodeResult } from '@/quadratic-core-types';
import { javascriptClient } from '../javascriptClient';
import { javascriptCore } from '../javascriptCore';
import { javascriptConvertOutputArray, javascriptConvertOutputType } from './javascriptOutput';

// The number of spaces the transpiled code is indented.
// const ESBUILD_INDENTATION = 2;

// // calculate the error line number but excluding the Quadratic library size
// function javascriptErrorLineNumber(stack: string): { text: string; line: number | null } {
//   const match = stack.match(/<anonymous>:(\d+):(\d+)/);
//   if (match) {
//     const line = parseInt(match[1]) - javascriptLibraryLines;
//     if (line >= 0) {
//       return { text: ` at line ${line}:${parseInt(match[2]) - ESBUILD_INDENTATION}`, line };
//     } else console.log(stack, match, line, javascriptLibraryLines);
//   }
//   return { text: '', line: null };
// }

export function javascriptErrorResult(transactionId: string, message: string, console?: string, lineNumber?: number) {
  const codeResult: JsCodeResult = {
    transaction_id: transactionId,
    success: false,
    output_value: null,
    std_err: message + console ? '\n' + console : '',
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
  console: string,
  lineNumber?: number
) {
  const message: string[] = [];
  const outputType = javascriptConvertOutputType(message, result, x, y);
  const outputArray = javascriptConvertOutputArray(message, result, x, y);
  const codeResult: JsCodeResult = {
    transaction_id: transactionId,
    success: true,
    output_value: outputType ? outputType.output : null,
    std_out: console + message.length ? message.join('\n') : '',
    std_err: null,
    output_array: outputArray ? outputArray.output : null,
    line_number: lineNumber !== undefined ? lineNumber + 1 : null,
    output_display_type: outputType?.displayType || outputArray?.displayType || null,
    cancel_compute: false,
  };
  javascriptCore.sendJavascriptResults(transactionId, codeResult);
  javascriptClient.sendState('ready', { current: undefined });
}
