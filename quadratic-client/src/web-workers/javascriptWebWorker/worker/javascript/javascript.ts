import { JsCodeResult, JsGetCellResponse } from '@/quadratic-core-types';
import type { CodeRun, LanguageState } from '@/web-workers/languageTypes';
import * as esbuild from 'esbuild-wasm';
import { CoreJavascriptRun } from '../../javascriptCoreMessages';
import { javascriptClient } from '../javascriptClient';
import { javascriptCore } from '../javascriptCore';
import { javascriptConsole } from './javascriptConsole';
import { javascriptLibrary, javascriptLibraryLines } from './javascriptLibrary';
import { javascriptConvertOutputArray, javascriptConvertOutputType, javascriptErrorLineNumber } from './javascriptUtil';

export type CellType = number | string | undefined;
export type CellPos = { x: number; y: number };

declare var self: WorkerGlobalScope &
  typeof globalThis & {
    getCells: (
      x0: number,
      y0: number,
      x1: number,
      y1: number,
      sheet?: string,
      lineNumber?: number
    ) => Promise<CellType[][] | undefined>;
    getCell: (x: number, y: number, sheet?: string, lineNumber?: number) => Promise<CellType | undefined>;
    c: (x: number, y: number, sheet?: string, lineNumber?: number) => Promise<CellType | undefined>;
    pos: () => { x: number; y: number };
    relCell: (x: number, y: number) => Promise<CellType | undefined>;
    rc: (x: number, y: number) => Promise<CellType | undefined>;
  };

class Javascript {
  private awaitingExecution: CodeRun[];

  state: LanguageState;

  // current running transaction
  private transactionId?: string;
  private column?: number;
  private row?: number;

  constructor() {
    this.awaitingExecution = [];
    this.state = 'loading';
    this.init();
    self.getCells = this.getCells;
    self.getCell = this.getCell;
    self.pos = this.getPos;
    self.c = this.getCell;
    self.relCell = this.relCell;
    self.rc = this.relCell;
  }

  private convertType(entry: JsGetCellResponse): CellType {
    return entry.type_name === 'number' ? parseFloat(entry.value) : entry.value;
  }

  private getCells = async (
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    sheet?: string,
    lineNumber?: number
  ): Promise<CellType[][] | undefined> => {
    if (!this.transactionId) {
      throw new Error('No transactionId in getCells');
    }
    const results = await javascriptCore.sendGetCells(
      this.transactionId,
      x0,
      y0,
      x1 - x0 + 1,
      y1 - y0 + 1,
      sheet,
      lineNumber
    );

    // error was thrown while getting cells (probably SheetName was not available)
    if (!results) {
      javascriptClient.sendState('ready');
      return undefined;
    }

    const cells: CellType[][] = [];
    for (let y = y0; y <= y1; y++) {
      const row: any[] = [];
      for (let x = x0; x <= x1; x++) {
        const entry = results.find((r) => Number(r.x) === x && Number(r.y) === y);
        if (entry) {
          const typed = this.convertType(entry);
          row.push(typed);
        } else {
          row.push(undefined);
        }
      }
      cells.push(row);
    }

    return cells;
  };

  private relCell = async (x: number, y: number) => {
    if (this.column === undefined || this.row === undefined) {
      throw new Error('Expected column and row to be defined in javascript.relCell');
    }
    return await this.getCell(this.column + x, this.row + y);
  };

  private getCell = async (
    x: number,
    y: number,
    sheet?: string,
    lineNumber?: number
  ): Promise<CellType | undefined> => {
    if (!this.transactionId) {
      throw new Error('No transactionId in getCell');
    }

    if (!this.transactionId) {
      throw new Error('No transactionId in getCells');
    }
    const results = await javascriptCore.sendGetCells(this.transactionId, x, y, x, y, sheet, lineNumber);

    // error was thrown while getting cells (probably SheetName was not available)
    if (!results) {
      javascriptClient.sendState('ready');
      return undefined;
    }

    if (results[0]) {
      return this.convertType(results[0]);
    }
  };

  private getPos = (): CellPos => {
    if (this.column === undefined || this.row === undefined) {
      throw new Error('Expected CellPos to be defined');
    }
    return { x: this.column, y: this.row };
  };

  init = async () => {
    await esbuild.initialize({
      wasmURL: '/esbuild.wasm',

      // todo: this would create another worker to run the actual code. I don't think this is necessary but it's an option.
      worker: false,
    });
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

  private async runAsyncCode(code: string) {
    const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
    return new Promise((resolve, reject) => {
      new AsyncFunction(
        'resolve',
        'reject',
        `try { const result = ${code}; resolve(result); } catch (e) { reject(e); }`
      )(resolve, reject);
    });
  }

  // separates imports from code so it can be placed above anonymous async function
  private transformCode(code: string) {
    // from https://stackoverflow.com/a/73265022/1955997
    const regExp =
      // eslint-disable-next-line no-useless-escape
      /import(?:(?:(?:[ \n\t]+([^ *\n\t\{\},]+)[ \n\t]*(?:,|[ \n\t]+))?([ \n\t]*\{(?:[ \n\t]*[^ \n\t"'\{\}]+[ \n\t]*,?)+\})?[ \n\t]*)|[ \n\t]*\*[ \n\t]*as[ \n\t]+([^ \n\t\{\}]+)[ \n\t]+)from[ \n\t]*(?:['"])([^'"\n]+)(['"])/gm;
    const imports = (code.match(regExp)?.join('\n') || '') + ';';
    let transformedCode = code.replace(regExp, '');
    return { code: transformedCode, imports };
  }

  async run(message: CoreJavascriptRun) {
    if (this.state !== 'ready') {
      this.awaitingExecution.push(this.coreJavascriptToCodeRun(message));
      return;
    }
    javascriptClient.sendState('running', {
      current: this.coreJavascriptToCodeRun(message),
      awaitingExecution: this.awaitingExecution,
    });

    this.transactionId = message.transactionId;
    this.column = message.x;
    this.row = message.y;
    let buildResult: esbuild.BuildResult;
    let code = '';
    const transform = this.transformCode(message.code);

    // Show an error if the user attempts to import modules (not yet supported)
    if (transform.imports !== ';') {
      const codeResult: JsCodeResult = {
        transaction_id: message.transactionId,
        success: false,
        output_value: null,
        std_err: 'Javascript import statements are not supported yet',
        std_out: null,
        output_array: null,
        line_number: null,
        output_display_type: null,
        cancel_compute: false,
      };
      javascriptCore.sendJavascriptResults(message.transactionId, codeResult);
      javascriptClient.sendState('ready');
      this.state = 'ready';
      setTimeout(this.next, 0);
      return;
    }

    // Keep track of all logs and warnings.
    let oldConsoleLog = console.log;
    let oldConsoleWarn = console.warn;
    javascriptConsole.reset();
    console.log = javascriptConsole.consoleMap;
    console.warn = javascriptConsole.consoleMap;

    // Build the code to convert TS to Javascript and wrap it in an async wrapper to enable top-level await.
    try {
      buildResult = await esbuild.build({
        stdin: {
          contents: '(async () => {' + javascriptLibrary + transform.code + '\n })();',
          loader: 'js',
        },

        // we use cjs since we don't want the output wrapped in another anonymous
        // function(we wrap it in an async function ourselves)
        format: 'cjs',

        write: false,
      });
      if (buildResult.outputFiles?.length) {
        code = buildResult.outputFiles[0].text;

        // Uncomments the below lines to see what the transpiled code looks
        // like. The library needs to be kept consistent with
        // javascriptLibrary#javascriptLibraryWithoutComments.
        //
        // console.log = oldConsoleLog;
        // console.log(code);
        // console.log = javascriptConsole.consoleMap;
      }
    } catch (e) {
      // Catch any build errors and use them as the return result.
      const failure = e as esbuild.BuildFailure;
      const codeResult: JsCodeResult = {
        transaction_id: message.transactionId,
        success: false,
        output_value: null,
        std_err: failure.errors
          .map(
            (e) =>
              `${e.text} ${
                e.location ? `on line ${e.location.line - javascriptLibraryLines + 1}:${e.location.column}` : ''
              }`
          )
          .join('\n'),
        std_out: null,
        output_array: null,
        line_number: null,
        output_display_type: null,
        cancel_compute: false,
      };
      javascriptCore.sendJavascriptResults(message.transactionId, codeResult);
      javascriptClient.sendState('ready');
      this.state = 'ready';
      console.log = oldConsoleLog;
      console.warn = oldConsoleWarn;
      setTimeout(this.next, 0);
      return;
    }

    if (buildResult.warnings.length > 0) {
      javascriptConsole.push(buildResult.warnings.map((w) => w.text));
    }
    let calculationResult: any;
    try {
      calculationResult = await this.runAsyncCode(code);
    } catch (e: any) {
      // Catch any thrown errors and use them as the return result.
      const errorLineNumber = javascriptErrorLineNumber(e.stack);
      const codeResult: JsCodeResult = {
        transaction_id: message.transactionId,
        success: false,
        output_value: null,
        std_err: e.message + errorLineNumber.text,
        std_out: javascriptConsole.output(),
        output_array: null,
        line_number: errorLineNumber.line,
        output_display_type: null,
        cancel_compute: false,
      };
      console.log = oldConsoleLog;
      console.warn = oldConsoleWarn;
      javascriptCore.sendJavascriptResults(message.transactionId, codeResult);
      javascriptClient.sendState('ready');
      this.state = 'ready';
      setTimeout(this.next, 0);
      return;
    }

    // Send the code result back to core.
    console.log = oldConsoleLog;
    console.warn = oldConsoleWarn;
    const outputType = javascriptConvertOutputType(calculationResult, message.x, message.y);
    const outputArray = javascriptConvertOutputArray(calculationResult, message.x, message.y);
    const codeResult: JsCodeResult = {
      transaction_id: message.transactionId,
      success: true,
      output_value: outputType ? outputType.output : null,
      std_out: javascriptConsole.output(),
      std_err: null,
      output_array: outputArray ? outputArray.output : null,
      line_number: null,
      output_display_type: outputType?.displayType || outputArray?.displayType || null,
      cancel_compute: false,
    };
    javascriptCore.sendJavascriptResults(message.transactionId, codeResult);
    javascriptClient.sendState('ready', { current: undefined });
    this.state = 'ready';
    setTimeout(this.next, 0);
  }
}

export const javascript = new Javascript();
