import { JsGetCellResponse } from '@/quadratic-core-types';
import type { CodeRun, LanguageState } from '@/web-workers/languageTypes';
import * as esbuild from 'esbuild-wasm';
import { CoreJavascriptRun } from '../javascriptCoreMessages';
import { javascriptClient } from './javascriptClient';
import { javascriptCore } from './javascriptCore';

class Javascript {
  private awaitingExecution: CodeRun[];
  state: LanguageState;
  private transactionId?: string;

  constructor() {
    this.awaitingExecution = [];
    this.state = 'loading';
    this.init();
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
      // we reload if there is an error getting cells
      this.init();
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

    const transform = await esbuild.transform(message.code, { loader: 'ts' });

    if (transform.warnings.length > 0) {
      // todo
      console.log(transform.warnings);
    }

    // eslint-disable-next-line no-eval
    const result = eval(transform.code);
    console.log(result);

    // todo: for use when adding libraries to js
    // const result2 = await esbuild.build({ write: false, bundle: true });
    debugger;
    javascriptClient.sendState('ready', { current: undefined });
    this.state = 'ready';
    setTimeout(this.next, 0);
  }
}

export const javascript = new Javascript();
