import { debugFlag } from '@/app/debugFlags/debugFlags';
import type { CodeRun } from '@/app/web-workers/CodeRun';
import type {
  ClientJavascriptGetJwt,
  ClientJavascriptMessage,
  JavascriptClientMessage,
} from '@/app/web-workers/javascriptWebWorker/javascriptClientMessages';
import { javascriptCore } from '@/app/web-workers/javascriptWebWorker/worker/javascriptCore';
import type { LanguageState } from '@/app/web-workers/languageTypes';

declare var self: WorkerGlobalScope & typeof globalThis;

class JavascriptClient {
  private id = 0;
  private waitingForResponse: Record<number, Function> = {};
  env: Record<string, string> = {};

  start() {
    self.onmessage = this.handleMessage;
    if (debugFlag('debugWebWorkers')) console.log('[javascriptClient] initialized.');
  }

  private send(message: JavascriptClientMessage, transfer?: Transferable[]) {
    if (transfer) {
      self.postMessage(message, transfer);
    } else {
      self.postMessage(message);
    }
  }

  private handleMessage = async (e: MessageEvent<ClientJavascriptMessage>) => {
    if (debugFlag('debugWebWorkersMessages')) console.log(`[coreClient] message: ${e.data.type}`);

    switch (e.data.type) {
      case 'clientJavascriptCoreChannel':
        this.env = e.data.env;
        javascriptCore.init(e.ports[0]);
        break;

      default:
        if (e.data.id !== undefined) {
          if (this.waitingForResponse[e.data.id]) {
            this.waitingForResponse[e.data.id](e.data);
            delete this.waitingForResponse[e.data.id];
          } else {
            console.warn('No resolve for message in javascriptClient', e.data.type);
          }
        } else {
          console.warn('[javascriptClient] Unhandled message type', e.data);
        }
    }
  };

  sendJavascriptLoadError(message?: string) {
    this.send({ type: 'javascriptClientLoadError', error: message });
  }

  sendState(state: LanguageState, options?: { error?: string; current?: CodeRun; awaitingExecution?: CodeRun[] }) {
    this.send({
      type: 'javascriptClientState',
      state,
      error: options?.error,
      current: options?.current,
      awaitingExecution: options?.awaitingExecution,
    });
  }

  sendInit(version: string) {
    this.send({ type: 'javascriptClientInit', version });
  }

  getJwt(): Promise<string> {
    return new Promise((resolve) => {
      const id = this.id++;
      this.waitingForResponse[id] = (message: ClientJavascriptGetJwt) => resolve(message.jwt);
      this.send({ type: 'javascriptClientGetJwt', id });
    });
  }
}

export const javascriptClient = new JavascriptClient();
