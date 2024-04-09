import { JsCodeResult, JsGetCellResponse } from '@/quadratic-core-types';
import type { CodeRun, LanguageState } from '@/web-workers/languageTypes';
import * as esbuild from 'esbuild-wasm';
import { CoreJavascriptRun } from '../javascriptCoreMessages';
import { javascriptClient } from './javascriptClient';
import { javascriptCore } from './javascriptCore';

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

// todo: this should be moved to an importable file
const library = `
  const getCells = async (x0: number, y0: number, x1: number, y1: number, sheetId?: string) => {
    const results = await self.getCells(x0, y0, x1, y1, sheetId);
    if (results) {
      const cells: any[][] = [];
      for (let y = y0; y <= y1; y++) {
        const row: any[] = [];
        for (let x = x0; x <= x1; x++) {
          const entry = results.find((r) => r.x === x && r.y === y);
          if (entry) {
            const typed = entry.type_name === 'number' ? parseFloat(entry.value) : entry.value;
            row.push(typed);
          } else {
            row.push(undefined);
          }
        }
        cells.push(row);
      }
      return cells;
    }
  };
  const getCell = async (x: number, y: number, sheetId: string) => {
    const results = await getCells(x, y, x, y, sheetId);
    return results?.[0]?.[0];
  };
  const c = getCell;
`;

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
        `try {
            const result = ${code};
            resolve(result);
          } catch (e) {
            reject(e);
          }`
      )(resolve, reject);
    });
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
    let transform: esbuild.TransformResult;
    try {
      transform = await esbuild.transform('(async () => {' + library + message.code + '})()', {
        loader: 'ts',
      });
    } catch (e: any) {
      const codeResult: JsCodeResult = {
        transaction_id: message.transactionId,
        success: false,
        output_value: null,
        std_err: e.message,
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

    // todo: for use when adding libraries to js
    // const result2 = await esbuild.build({ write: false, bundle: true });

    if (transform.warnings.length > 0) {
      console.log(transform.warnings);
    }

    let calculationResult: any;
    let oldConsoleLog = console.log;
    const logs: any[] = [];
    try {
      console.log = (message: any) => logs.push(message);
      calculationResult = await this.runAsyncCode(transform.code);
    } catch (e: any) {
      const codeResult: JsCodeResult = {
        transaction_id: message.transactionId,
        success: false,
        output_value: null,
        std_err: e.message,
        std_out: logs.length ? logs.join('\n') : null,
        output_array: null,
        line_number: null,
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
