import { JsCodeResult } from '@/quadratic-core-types';
import { javascriptClient } from '../javascriptClient';
import { javascriptCore } from '../javascriptCore';
import { javascriptLibraryLines } from './javascriptLibrary';
import { javascriptConvertOutputArray, javascriptConvertOutputType } from './javascriptOutput';

// The number of spaces the transpiled code is indented.
const ESBUILD_INDENTATION = 2;

// calculate the error line number but excluding the Quadratic library size
function javascriptErrorLineNumber(stack: string): { text: string; line: number | null } {
  const match = stack.match(/<anonymous>:(\d+):(\d+)/);
  if (match) {
    const line = parseInt(match[1]) - javascriptLibraryLines;
    if (line >= 0) {
      return { text: ` at line ${line}:${parseInt(match[2]) - ESBUILD_INDENTATION}`, line };
    } else console.log(stack, match, line, javascriptLibraryLines);
  }
  return { text: '', line: null };
}

export function javascriptErrorResult(transactionId: string, message: string, stack: string) {
  const errorLineNumber = javascriptErrorLineNumber(stack);
  const codeResult: JsCodeResult = {
    transaction_id: transactionId,
    success: false,
    output_value: null,
    std_err: message + errorLineNumber.text,
    std_out: '', //javascriptConsole.output(),
    output_array: null,
    line_number: errorLineNumber.line,
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
  const outputType = javascriptConvertOutputType(result, x, y);
  const outputArray = javascriptConvertOutputArray(result, x, y);
  const codeResult: JsCodeResult = {
    transaction_id: transactionId,
    success: true,
    output_value: outputType ? outputType.output : null,
    std_out: console,
    std_err: null,
    output_array: outputArray ? outputArray.output : null,
    line_number: lineNumber !== undefined ? lineNumber + 1 : null,
    output_display_type: outputType?.displayType || outputArray?.displayType || null,
    cancel_compute: false,
  };
  javascriptCore.sendJavascriptResults(transactionId, codeResult);
  javascriptClient.sendState('ready', { current: undefined });
}
