import { debugWebWorkers, debugWebWorkersMessages } from '@/app/debugFlags';
import { LanguageState } from '@/app/web-workers/languageTypes';
import { CodeRun } from '../../CodeRun';
import type { ClientJavascriptMessage, JavascriptClientMessage } from '../javascriptClientMessages';
import { javascriptCore } from './javascriptCore';

declare var self: WorkerGlobalScope & typeof globalThis;

class JavascriptClient {
  start() {
    self.onmessage = this.handleMessage;
    if (debugWebWorkers) console.log('[javascriptClient] initialized.');
  }

  private send(message: JavascriptClientMessage, transfer?: Transferable[]) {
    if (transfer) {
      self.postMessage(message, transfer);
    } else {
      self.postMessage(message);
    }
  }

  private handleMessage = async (e: MessageEvent<ClientJavascriptMessage>) => {
    if (debugWebWorkersMessages) console.log(`[coreClient] message: ${e.data.type}`);

    switch (e.data.type) {
      case 'clientJavascriptCoreChannel':
        javascriptCore.init(e.ports[0]);
        break;

      default:
        console.warn('[coreClient] Unhandled message type', e.data);
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
}

export const javascriptClient = new JavascriptClient();
