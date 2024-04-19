/* eslint-disable @typescript-eslint/no-unused-vars */
import type { CodeRun, LanguageState } from '@/web-workers/languageTypes';
import { CoreJavascriptRun } from '../../javascriptCoreMessages';
import { javascriptClient } from '../javascriptClient';
import { JavascriptAPI } from './javascriptAPI';
import { prepareJavascriptCode } from './javascriptCompile';
import { javascriptConsole } from './javascriptConsole';
import { javascriptErrorResult, javascriptResults } from './javascriptResults';
import { JavascriptRunnerGetCells, RunnerJavascriptMessage } from './javascriptRunnerMessages';

export const LINE_NUMBER_VAR = '___line_number___';

export class Javascript {
  private api: JavascriptAPI;
  private awaitingExecution: CodeRun[];

  state: LanguageState;

  // current running transaction
  transactionId?: string;
  column?: number;
  row?: number;
  private withLineNumbers = true;

  constructor() {
    this.awaitingExecution = [];
    this.state = 'loading';
    this.init();
    this.api = new JavascriptAPI(this);
  }

  init = async () => {
    // await esbuild.initialize({
    //   wasmURL: '/esbuild.wasm',

    //   // this would create another worker to run the actual code. I don't
    //   // think this is necessary but it's an option.
    //   worker: false,
    // });
    this.state = 'ready';
    javascriptClient.sendState('ready');
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
        this.state = 'ready';
      }
    }
  };

  // private async runAsyncCode(code: string): Promise<[any, number]> {
  //   const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  //   let transformedCode: string;
  //   if (this.withLineNumbers) {
  //     code = `try { let ${LINE_NUMBER_VAR} = 0; const result = await ${code}; resolve([result, ${LINE_NUMBER_VAR}]); } catch (e) { reject(e); }`;
  //   } else {
  //     code = `try { const result = await ${code}; resolve([result, undefined]); } catch (e) { reject(e); }`;
  //   }
  //   return new Promise((resolve, reject) => {
  //     new AsyncFunction('resolve', 'reject', transformedCode)(resolve, reject);
  //   });
  // }

  async run(message: CoreJavascriptRun, withLineNumbers = true) {
    if (this.state !== 'ready') {
      this.awaitingExecution.push(this.coreJavascriptToCodeRun(message));
      return;
    }
    this.withLineNumbers = withLineNumbers;
    javascriptClient.sendState('running', {
      current: this.coreJavascriptToCodeRun(message),
      awaitingExecution: this.awaitingExecution,
    });
    this.transactionId = message.transactionId;
    this.column = message.x;
    this.row = message.y;
    // let buildResult: esbuild.BuildResult;

    // // Show an error if the user attempts to import modules (not yet supported)
    // if (transform.imports !== ';') {
    //   const codeResult: JsCodeResult = {
    //     transaction_id: message.transactionId,
    //     success: false,
    //     output_value: null,
    //     std_err: 'Javascript import statements are not supported yet',
    //     std_out: null,
    //     output_array: null,
    //     line_number: null,
    //     output_display_type: null,
    //     cancel_compute: false,
    //   };
    //   javascriptCore.sendJavascriptResults(message.transactionId, codeResult);
    //   javascriptClient.sendState('ready');
    //   this.state = 'ready';
    //   setTimeout(this.next, 0);
    //   return;
    // }

    // Keep track of all logs and warnings.
    // let oldConsoleLog = console.log;
    // let oldConsoleWarn = console.warn;
    javascriptConsole.reset();
    // console.log = javascriptConsole.consoleMap;
    // console.warn = javascriptConsole.consoleMap;

    // Build the code to convert TS to Javascript and wrap it in an async
    // wrapper to enable top-level await. First, we try the naive line number
    // variable.
    // try {
    //   buildResult = await esbuild.build({
    //     stdin: {
    //       contents: prepareJavascriptCode(transform, this.withLineNumbers),
    //       loader: 'js',
    //     },

    //     format: 'esm',
    //     bundle: false,
    //     write: false,
    //   });
    //   if (buildResult.outputFiles?.length) {
    //     code = buildResult.outputFiles[0].text;
    //     // Uncomments the below lines to see what the transpiled code looks
    //     // like. The library needs to be kept consistent with
    //     // javascriptLibrary#javascriptLibraryWithoutComments.
    //     //
    //     // oldConsoleLog(code);
    //   }
    // } catch (e) {
    //   // try it without the line number variable
    //   if (this.withLineNumbers) {
    //     this.run(message, false);
    //     return;
    //   }

    //   // Catch any build errors and use them as the return result.
    //   const failure = e as esbuild.BuildFailure;
    //   const codeResult: JsCodeResult = {
    //     transaction_id: message.transactionId,
    //     success: false,
    //     output_value: null,
    //     std_err: failure.errors
    //       .map(
    //         (e) =>
    //           `${e.text} ${
    //             e.location ? `on line ${e.location.line - javascriptLibraryLines + 1}:${e.location.column}` : ''
    //           }`
    //       )
    //       .join('\n'),
    //     std_out: null,
    //     output_array: null,
    //     line_number: null,
    //     output_display_type: null,
    //     cancel_compute: false,
    //   };
    //   javascriptCore.sendJavascriptResults(message.transactionId, codeResult);
    //   javascriptClient.sendState('ready');
    //   this.state = 'ready';
    //   console.log = oldConsoleLog;
    //   console.warn = oldConsoleWarn;
    //   setTimeout(this.next, 0);
    //   return;
    // }

    // if (buildResult.warnings.length > 0) {
    //   javascriptConsole.push(buildResult.warnings.map((w) => w.text));
    // }
    // let calculationResult: any, lineNumber: number | undefined;
    try {
      const code = prepareJavascriptCode(message, this.withLineNumbers);
      const runner = new Worker(URL.createObjectURL(new Blob([code], { type: 'application/javascript' })), {
        type: 'module',
      });
      runner.onerror = (e) => {
        console.log(e);
        debugger;
      };
      runner.onmessage = (e: MessageEvent<RunnerJavascriptMessage>) => {
        if (e.data.type === 'results') {
          javascriptResults(message.transactionId, message.x, message.y, e.data.results, e.data.console);
          this.state = 'ready';
          setTimeout(this.next, 0);
        } else if (e.data.type === 'getCells') {
          this.api.getCells(e.data.x0, e.data.y0, e.data.x1, e.data.y1, e.data.sheetName).then((results) => {
            if (results) {
              const message: JavascriptRunnerGetCells = results;
              runner.postMessage(message);
            } else {
              // todo: we're done here b/c of an error in getCells (sheet name was incorrect)...
            }
          });
        } else {
          throw new Error('Unknown message type from javascript runner.');
        }
        console.log(e);
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
