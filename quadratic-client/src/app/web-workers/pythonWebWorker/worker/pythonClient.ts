import { debugFlag } from '@/app/debugFlags/debugFlags';
import type { CodeRun } from '@/app/web-workers/CodeRun';
import type { LanguageState } from '@/app/web-workers/languageTypes';
import type {
  ClientPythonGetJwt,
  ClientPythonMessage,
  PythonClientMessage,
} from '@/app/web-workers/pythonWebWorker/pythonClientMessages';
import { pythonCore } from '@/app/web-workers/pythonWebWorker/worker/pythonCore';

declare var self: WorkerGlobalScope & typeof globalThis & {};

// Any public functions need to be added to the python.test.ts mock:
//
// ```ts
// vi.mock('./pythonClient.ts', () => {
// ```
class PythonClient {
  private id = 0;
  private waitingForResponse: Record<number, Function> = {};
  private _env: Record<string, string> = {};

  get env() {
    return this._env;
  }

  start() {
    self.onmessage = this.handleMessage;
    if (debugFlag('debugWebWorkers')) console.log('[pythonClient] initialized.');
  }

  private send(message: PythonClientMessage, transfer?: Transferable[]) {
    if (transfer) {
      self.postMessage(message, transfer);
    } else {
      self.postMessage(message);
    }
  }

  private handleMessage = async (e: MessageEvent<ClientPythonMessage>) => {
    if (debugFlag('debugWebWorkersMessages')) console.log(`[pythonClient] message: ${e.data.type}`);

    switch (e.data.type) {
      case 'clientPythonCoreChannel':
        pythonCore.init(e.ports[0]);
        break;

      case 'clientPythonInit':
        this._env = e.data.env;
        return;

      default:
        if (e.data.id !== undefined) {
          if (this.waitingForResponse[e.data.id]) {
            this.waitingForResponse[e.data.id](e.data);
            delete this.waitingForResponse[e.data.id];
          } else {
            console.warn('No resolve for message in pythonClient', e.data.type);
          }
        } else {
          console.warn('[pythonClient] Unhandled message type', e.data);
        }
    }
  };

  sendPythonLoadError(message?: string) {
    this.send({ type: 'pythonClientLoadError', error: message });
  }

  sendPythonState(
    state: LanguageState,
    options?: { error?: string; current?: CodeRun; awaitingExecution?: CodeRun[] }
  ) {
    this.send({
      type: 'pythonClientState',
      state,
      error: options?.error,
      current: options?.current,
      awaitingExecution: options?.awaitingExecution,
    });
  }

  sendInit(version: string) {
    this.send({ type: 'pythonClientInit', version });
  }

  getJwt() {
    return new Promise((resolve) => {
      const id = this.id++;
      this.waitingForResponse[id] = (message: ClientPythonGetJwt) => resolve(message.jwt);
      this.send({ type: 'pythonClientGetJwt', id });
    });
  }
}

export const pythonClient = new PythonClient();
