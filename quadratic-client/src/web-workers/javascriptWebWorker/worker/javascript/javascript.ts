import { JsCodeResult, JsGetCellResponse } from '@/quadratic-core-types';
import type { CodeRun, LanguageState } from '@/web-workers/languageTypes';
import * as esbuild from 'esbuild-wasm';
import { CoreJavascriptRun } from '../../javascriptCoreMessages';
import { javascriptClient } from '../javascriptClient';
import { javascriptCore } from '../javascriptCore';
import { javascriptLibrary, javascriptLibraryLines } from './javascriptLibrary';

const ESBUILD_INDENTATION = 2;

declare var self: WorkerGlobalScope &
  typeof globalThis & {
    getCells: (
      x0: number,
      y0: number,
      x1: number,
      y1: number,
      sheet?: string,
      lineNumber?: number
    ) => Promise<JsGetCellResponse[] | undefined>;
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
  }

  private getCells = async (
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    sheet?: string,
    lineNumber?: number
  ): Promise<JsGetCellResponse[] | undefined> => {
    if (!this.transactionId) {
      throw new Error('No transactionId in getCells');
    }
    const cells = await javascriptCore.sendGetCells(
      this.transactionId,
      x0,
      y0,
      x1 - x0 + 1,
      y1 - y0 + 1,
      sheet,
      lineNumber
    );
    if (!cells) {
      javascriptClient.sendState('ready');
    } else {
      return cells;
    }
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

  private convertOutputType(value: any, logs: string[], x?: number, y?: number): string[] | null {
    if (Array.isArray(value)) {
      return null;
    }
    if (typeof value === 'number') {
      return [value.toString(), 'number'];
    } else if (typeof value === 'string') {
      return [value, 'text'];
    } else if (value === undefined) {
      return null;
    } else {
      const column = this.column!;
      const row = this.row!;
      logs.push(
        `WARNING: Unsupported output type "${typeof value}" ${
          x !== undefined && y !== undefined ? `at cell(${column + x}, ${row + y})` : ''
        }`
      );
      return null;
    }
  }

  private convertOutputArray(value: any, logs: string[]): string[][][] | null {
    if (!Array.isArray(value)) {
      return null;
    }
    if (!Array.isArray(value[0])) {
      return value.map((v: any, y: number) => {
        const outputValue = this.convertOutputType(v, logs, 0, y);
        if (outputValue) return [outputValue];
        return [['', 'text']];
      });
    } else {
      return value.map((v: any[], y: number) => {
        return v.map((v2: any[], x: number) => {
          const outputValue = this.convertOutputType(v2, logs, x, y);
          if (outputValue) return outputValue;
          return ['', 'text'];
        });
      });
    }
  }

  private async runAsyncCode(code: string) {
    const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
    return new Promise((resolve, reject) => {
      new AsyncFunction(
        'resolve',
        'reject',
        `try { const result = ${code};resolve(result); } catch (e) { reject(e); }`
      )(resolve, reject);
    });
  }

  private errorLineNumber(stack: string): { text: string; line: number | null } {
    const match = stack.match(/<anonymous>:(\d+):(\d+)/);
    if (match) {
      const line = parseInt(match[1]) - javascriptLibraryLines;
      return { text: ` at line ${line}:${parseInt(match[2]) - ESBUILD_INDENTATION}`, line };
    }
    return { text: '', line: null };
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
    try {
      buildResult = await esbuild.build({
        stdin: {
          contents: '(async () => {' + javascriptLibrary + transform.code + '})()',
          loader: 'ts',
        },

        // we use cjs since we don't want the output wrapped in another anonymous
        // function(we wrap it in an async function ourselves)
        format: 'cjs',

        write: false,
      });
      if (buildResult.outputFiles?.length) {
        code = buildResult.outputFiles[0].text;
      }
    } catch (e) {
      const failure = e as esbuild.BuildFailure;
      console.log(failure.errors);
      debugger;
      const codeResult: JsCodeResult = {
        transaction_id: message.transactionId,
        success: false,
        output_value: null,
        std_err: null,
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

    if (buildResult.warnings.length > 0) {
      console.log(buildResult.warnings);
    }
    let calculationResult: any;
    let oldConsoleLog = console.log;
    const logs: any[] = [];
    try {
      console.log = (message: any) => logs.push(message);
      calculationResult = await this.runAsyncCode(code);
    } catch (e: any) {
      const errorLineNumber = this.errorLineNumber(e.stack);
      const codeResult: JsCodeResult = {
        transaction_id: message.transactionId,
        success: false,
        output_value: null,
        std_err: e.message + errorLineNumber.text,
        std_out: logs.length ? logs.join('\n') : null,
        output_array: null,
        line_number: errorLineNumber.line,
        output_display_type: null,
        cancel_compute: false,
      };
      console.log = oldConsoleLog;
      javascriptCore.sendJavascriptResults(message.transactionId, codeResult);
      javascriptClient.sendState('ready');
      this.state = 'ready';
      setTimeout(this.next, 0);
      return;
    }
    console.log = oldConsoleLog;
    const output_value = this.convertOutputType(calculationResult, logs);
    const output_array = this.convertOutputArray(calculationResult, logs);
    const codeResult: JsCodeResult = {
      transaction_id: message.transactionId,
      success: true,
      output_value,
      std_out: logs.length ? logs.join('\n') : null,
      std_err: null,
      output_array,
      line_number: null,
      output_display_type: 'text',
      cancel_compute: false,
    };
    javascriptCore.sendJavascriptResults(message.transactionId, codeResult);
    javascriptClient.sendState('ready', { current: undefined });
    this.state = 'ready';
    setTimeout(this.next, 0);
  }
}

export const javascript = new Javascript();
