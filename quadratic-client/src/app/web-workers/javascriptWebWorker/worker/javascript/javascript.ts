// This file is the main entry point for the javascript worker. It handles
// managing the Javascript runners, which is where the code is executed.

import { getHasSharedArrayBuffer } from '@/app/helpers/sharedArrayBufferSupport';
import type { JsCellsA1Response } from '@/app/quadratic-core-types';
import { toUint8Array } from '@/app/shared/utils/Uint8Array';
import type { CodeRun } from '@/app/web-workers/CodeRun';
import type { CoreJavascriptRun } from '@/app/web-workers/javascriptWebWorker/javascriptCoreMessages';
import {
  javascriptFindSyntaxError,
  prepareJavascriptCode,
  transformCode,
} from '@/app/web-workers/javascriptWebWorker/worker/javascript/javascriptCompile';
import {
  javascriptErrorResult,
  javascriptResults,
} from '@/app/web-workers/javascriptWebWorker/worker/javascript/javascriptResults';
import type { RunnerJavascriptMessage } from '@/app/web-workers/javascriptWebWorker/worker/javascript/javascriptRunnerMessages';
import { javascriptLibraryLines } from '@/app/web-workers/javascriptWebWorker/worker/javascript/runner/generateJavascriptForRunner';
import { javascriptClient } from '@/app/web-workers/javascriptWebWorker/worker/javascriptClient';
import { javascriptCore } from '@/app/web-workers/javascriptWebWorker/worker/javascriptCore';
import type { LanguageState } from '@/app/web-workers/languageTypes';
import * as esbuild from 'esbuild-wasm';

export const LINE_NUMBER_VAR = '___line_number___';

export class Javascript {
  private awaitingExecution: CodeRun[];
  private id = 0;
  private getCellsResponses: Record<number, Uint8Array> = {};

  private state: LanguageState = 'loading';

  private withLineNumbers = true;

  constructor() {
    this.awaitingExecution = [];
    this.init();
  }

  private init = async () => {
    await esbuild.initialize({
      wasmURL: '/esbuild.wasm',
      // this would create another worker to run the actual code. I don't
      // think this is necessary but it's an option.
      worker: false,
    });

    this.state = 'ready';
    javascriptClient.sendInit(esbuild.version);
    return this.next();
  };

  private getCellsA1 = async (transactionId: string, a1: string): Promise<ArrayBuffer> => {
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

  private codeRunToCoreJavascript = (codeRun: CodeRun): CoreJavascriptRun => ({
    type: 'coreJavascriptRun',
    transactionId: codeRun.transactionId,
    x: codeRun.sheetPos.x,
    y: codeRun.sheetPos.y,
    sheetId: codeRun.sheetPos.sheetId,
    code: codeRun.code,
  });

  private coreJavascriptToCodeRun = (coreJavascriptRun: CoreJavascriptRun): CodeRun => ({
    transactionId: coreJavascriptRun.transactionId,
    sheetPos: { x: coreJavascriptRun.x, y: coreJavascriptRun.y, sheetId: coreJavascriptRun.sheetId },
    code: coreJavascriptRun.code,
    chartPixelWidth: 0,
    chartPixelHeight: 0,
  });

  private next = (): Promise<void> | undefined => {
    if (this.state === 'ready' && this.awaitingExecution.length > 0) {
      const run = this.awaitingExecution.shift();
      if (run) {
        return this.run(this.codeRunToCoreJavascript(run));
      }
    } else {
      javascriptClient.sendState('ready');
    }
  };

  run = async (message: CoreJavascriptRun, withLineNumbers = true): Promise<void> => {
    if (this.state !== 'ready') {
      this.awaitingExecution.push(this.coreJavascriptToCodeRun(message));
      // Send state update - Rust handles code running state via coreClientCodeRunningState
      javascriptClient.sendState(this.state);
      return;
    }

    this.state = 'running';
    javascriptClient.sendState('running');

    this.withLineNumbers = withLineNumbers;

    const transformedCode = transformCode(message.code);
    if (withLineNumbers) {
      const error = await javascriptFindSyntaxError(transformedCode);
      if (error) {
        javascriptErrorResult(message.transactionId, error.text, error.lineNumber);
        this.state = 'ready';
        return this.next();
      }
    }

    try {
      const proxyUrl = `${javascriptClient.env.VITE_QUADRATIC_CONNECTION_URL}/proxy`;
      const jwt = await javascriptClient.getJwt();
      const code = prepareJavascriptCode(
        transformedCode,
        message.x,
        message.y,
        this.withLineNumbers,
        proxyUrl,
        jwt,
        getHasSharedArrayBuffer()
      );
      const objUrl = URL.createObjectURL(new Blob([code], { type: 'application/javascript' }));
      const runner = new Worker(objUrl, {
        type: 'module',
        name: 'javascriptWorker',
      });

      const cleanup = () => {
        runner.terminate();
        URL.revokeObjectURL(objUrl);
      };

      runner.onerror = (e) => {
        cleanup();

        if (this.withLineNumbers) {
          return this.run(message, false);
        }

        // todo: handle worker errors (although there should not be any as the Worker
        // should catch all user code errors)
        javascriptErrorResult(message.transactionId, e.message);
        this.state = 'ready';
        return this.next();
      };

      runner.onmessage = (e: MessageEvent<RunnerJavascriptMessage>) => {
        if (e.data.type === 'results') {
          javascriptResults(
            message.transactionId,
            message.x,
            message.y,
            e.data.results,
            e.data.console,
            e.data.lineNumber,
            e.data.chartPixelOutput
          );
          cleanup();
          this.state = 'ready';
          return this.next();
        } else if (e.data.type === 'getCellsA1Length') {
          const { sharedBuffer, a1 } = e.data;
          const int32View = new Int32Array(sharedBuffer, 0, 3);
          this.getCellsA1(message.transactionId, a1)
            .then((cellsBuffer) => {
              if (cellsBuffer) {
                const cellsUint8Array = new Uint8Array(cellsBuffer, 0, cellsBuffer.byteLength);
                const byteLength = cellsUint8Array.byteLength;
                Atomics.store(int32View, 1, byteLength);

                if (byteLength !== 0) {
                  const id = this.id++;
                  this.getCellsResponses[id] = cellsUint8Array;
                  Atomics.store(int32View, 2, id);
                }
              } else {
                Atomics.store(int32View, 1, 0);
              }
            })
            .catch((error) => {
              console.error('[javascript] getCellsA1 error:', error);
            })
            .finally(() => {
              Atomics.store(int32View, 0, 1);
              Atomics.notify(int32View, 0, 1);
            });
        } else if (e.data.type === 'getCellsData') {
          const { id, sharedBuffer } = e.data;
          const int32View = new Int32Array(sharedBuffer, 0, 1);

          const cellsUint8Array = this.getCellsResponses[id];
          delete this.getCellsResponses[id];
          if (cellsUint8Array === undefined) {
            console.error('[javascript] No cells found for id:', e.data.id);
          } else {
            const uint8View = new Uint8Array(e.data.sharedBuffer, 4, cellsUint8Array.byteLength);
            uint8View.set(cellsUint8Array);
          }

          Atomics.store(int32View, 0, 1);
          Atomics.notify(int32View, 0, 1);
        } else if (e.data.type === 'getCellsA1Async') {
          // Async cell request (used when SharedArrayBuffer is not available)
          const { requestId, a1 } = e.data;
          this.getCellsA1(message.transactionId, a1)
            .then((cellsBuffer) => {
              const decoder = new TextDecoder();
              const resultsStringified = decoder.decode(new Uint8Array(cellsBuffer));
              runner.postMessage({
                type: 'getCellsA1AsyncResponse',
                requestId,
                resultsStringified,
              });
            })
            .catch((error) => {
              runner.postMessage({
                type: 'getCellsA1AsyncResponse',
                requestId,
                error: error.message || 'Failed to get cells',
              });
            });
        } else if (e.data.type === 'error') {
          cleanup();

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

          javascriptErrorResult(message.transactionId, errorMessage, errorLine);
          this.state = 'ready';
          return this.next();
        } else {
          console.error('[javascript] Unknown message type:', e.data);
          cleanup();
          this.state = 'ready';
          return this.next();
        }
      };
    } catch (e: any) {
      javascriptErrorResult(message.transactionId, e.message, e.stack);
      this.state = 'ready';
      return this.next();
    }
  };
}

export const javascript = new Javascript();
