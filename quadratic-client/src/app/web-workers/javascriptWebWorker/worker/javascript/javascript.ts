// This file is the main entry point for the javascript worker. It handles
// managing the Javascript runners, which is where the code is executed.

import type { CodeRun } from '@/app/web-workers/CodeRun';
import type { LanguageState } from '@/app/web-workers/languageTypes';
import * as esbuild from 'esbuild-wasm';
import { CoreJavascriptRun } from '../../javascriptCoreMessages';
import { javascriptClient } from '../javascriptClient';
import { JavascriptAPI } from './javascriptAPI';
import { javascriptFindSyntaxError, prepareJavascriptCode, transformCode } from './javascriptCompile';
import { javascriptErrorResult, javascriptResults } from './javascriptResults';
import { RunnerJavascriptMessage } from './javascriptRunnerMessages';
import { javascriptLibraryLines } from './runner/generateJavascriptForRunner';

export const LINE_NUMBER_VAR = '___line_number___';

export class Javascript {
  private api: JavascriptAPI;
  private awaitingExecution: CodeRun[];
  private id = 0;
  private getCellsResponses: Record<number, string> = {};

  state: LanguageState = 'loading';

  // current running transaction
  transactionId?: string;
  column?: number;
  row?: number;
  private withLineNumbers = true;

  constructor() {
    this.awaitingExecution = [];
    this.init();
    this.api = new JavascriptAPI(this);
  }

  init = async () => {
    await esbuild.initialize({
      wasmURL: '/esbuild.wasm',
      // this would create another worker to run the actual code. I don't
      // think this is necessary but it's an option.
      worker: false,
    });

    this.state = 'ready';
    this.next();
  };

  private codeRunToCoreJavascript = (codeRun: CodeRun): CoreJavascriptRun => ({
    type: 'coreJavascriptRun',
    transactionId: codeRun.transactionId,
    x: codeRun.sheetPos.x,
    y: codeRun.sheetPos.y,
    sheetId: codeRun.sheetPos.sheetId,
    code: codeRun.code,
  });

  private coreJavascriptToCodeRun = (coreJavascriptRun: CoreJavascriptRun) => ({
    transactionId: coreJavascriptRun.transactionId,
    sheetPos: { x: coreJavascriptRun.x, y: coreJavascriptRun.y, sheetId: coreJavascriptRun.sheetId },
    code: coreJavascriptRun.code,
  });

  private next = async () => {
    if (this.state === 'ready' && this.awaitingExecution.length > 0) {
      const run = this.awaitingExecution.shift();
      if (run) {
        await this.run(this.codeRunToCoreJavascript(run));
      }
    } else {
      javascriptClient.sendState('ready');
    }
  };

  async run(message: CoreJavascriptRun, withLineNumbers = true) {
    if (this.state !== 'ready') {
      this.awaitingExecution.push(this.coreJavascriptToCodeRun(message));
      return;
    }

    const transformedCode = transformCode(message.code);
    if (withLineNumbers) {
      const error = await javascriptFindSyntaxError(transformedCode);
      if (error) {
        javascriptErrorResult(message.transactionId, error.text, error.lineNumber);
        return;
      }
    }

    this.withLineNumbers = withLineNumbers;
    javascriptClient.sendState('running', {
      current: this.coreJavascriptToCodeRun(message),
      awaitingExecution: this.awaitingExecution,
    });
    this.transactionId = message.transactionId;
    this.column = message.x;
    this.row = message.y;

    try {
      const code = prepareJavascriptCode(transformedCode, message.x, message.y, this.withLineNumbers);
      const runner = new Worker(URL.createObjectURL(new Blob([code], { type: 'application/javascript' })), {
        type: 'module',
        name: 'javascriptWorker',
      });
      runner.onerror = (e) => {
        if (this.withLineNumbers) {
          runner.terminate();
          this.run(message, false);
          return;
        }
        // todo: handle worker errors (although there should not be any as the Worker
        // should catch all user code errors)
        javascriptErrorResult(message.transactionId, e.message);
        this.state = 'ready';
        setTimeout(this.next, 0);
      };
      runner.onmessage = (e: MessageEvent<RunnerJavascriptMessage>) => {
        if (e.data.type === 'results') {
          javascriptResults(
            message.transactionId,
            message.x,
            message.y,
            e.data.results,
            e.data.console,
            e.data.lineNumber
          );
          this.state = 'ready';
          setTimeout(this.next, 0);
          runner.terminate();
        } else if (e.data.type === 'getCellsLength') {
          const { sharedBuffer, x0, y0, x1, y1, sheetName } = e.data;
          this.api.getCells(x0, y0, x1, y1, sheetName).then((cells) => {
            const int32View = new Int32Array(sharedBuffer, 0, 3);
            if (cells) {
              const cellsString = JSON.stringify(cells);
              const length = cellsString.length;
              Atomics.store(int32View, 1, length);
              const id = this.id++;
              this.getCellsResponses[id] = cellsString;
              Atomics.store(int32View, 2, id);
              Atomics.store(int32View, 0, 1);
              Atomics.notify(int32View, 0, 1);
            } else {
              Atomics.store(int32View, 1, 0);
              Atomics.store(int32View, 0, 1);
              Atomics.notify(int32View, 0, 1);
              this.state = 'ready';
              setTimeout(this.next, 0);
            }
          });
        } else if (e.data.type === 'getCellsData') {
          const { id, sharedBuffer } = e.data;
          const cells = this.getCellsResponses[id];
          delete this.getCellsResponses[id];
          const int32View = new Int32Array(sharedBuffer, 0, 1);
          if (cells === undefined) {
            console.error('[javascript] No cells found for id:', e.data.id);
          } else {
            const encoder = new TextEncoder();
            const encodedCells = encoder.encode(cells);
            const uint8View = new Uint8Array(e.data.sharedBuffer, 4, encodedCells.length);
            uint8View.set(encodedCells);
          }
          Atomics.store(int32View, 0, 1);
          Atomics.notify(int32View, 0, 1);
        } else if (e.data.type === 'error') {
          let errorLine: number | undefined;
          let errorColumn: number | undefined;
          let errorMessage = e.data.error;
          if (e.data.stack) {
            const stack = e.data.stack;
            if (Array.isArray(stack)) {
              const errorSplit = stack.split('\n')[1].split(':');
              if (errorSplit.length >= 2) {
                errorLine = parseInt(errorSplit[errorSplit.length - 2]);
                errorColumn = parseInt(errorSplit[errorSplit.length - 1]);
                if (isNaN(errorLine)) {
                  errorLine = undefined;
                } else {
                  errorLine -= javascriptLibraryLines - 1;
                  if (errorLine < 0) {
                    errorLine = undefined;
                  } else {
                    errorMessage += ` at line ${errorLine}:${errorColumn}`;
                  }
                }
              }
            }
          }
          if (e.data.console) {
            errorMessage += '\n' + e.data.console;
          }
          runner.terminate();
          javascriptErrorResult(message.transactionId, errorMessage, errorLine);
          this.state = 'ready';
          setTimeout(this.next, 0);
        } else {
          throw new Error('Unknown message type from javascript runner');
        }
      };
    } catch (e: any) {
      javascriptErrorResult(message.transactionId, e.message, e.stack);
      this.state = 'ready';
      setTimeout(this.next, 0);
      return;
    }
  }
}

export const javascript = new Javascript();
