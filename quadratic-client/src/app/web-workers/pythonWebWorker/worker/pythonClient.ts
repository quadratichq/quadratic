import { debugWebWorkers, debugWebWorkersMessages } from '@/app/debugFlags';
import type { ClientPythonMessage, CodeRun, PythonClientMessage, PythonStateType } from '../pythonClientMessages';
import { pythonCore } from './pythonCore';

declare var self: WorkerGlobalScope & typeof globalThis & {};

class PythonClient {
  start() {
    self.onmessage = this.handleMessage;
    if (debugWebWorkers) console.log('[pythonClient] initialized.');
  }

  private send(message: PythonClientMessage, transfer?: Transferable[]) {
    if (transfer) {
      self.postMessage(message, transfer);
    } else {
      self.postMessage(message);
    }
  }

  private handleMessage = async (e: MessageEvent<ClientPythonMessage>) => {
    if (debugWebWorkersMessages) console.log(`[coreClient] message: ${e.data.type}`);

    switch (e.data.type) {
      case 'clientPythonCoreChannel':
        pythonCore.init(e.ports[0]);
        break;

      default:
        console.warn('[coreClient] Unhandled message type', e.data);
    }
  };

  sendPythonLoadError(message?: string) {
    this.send({ type: 'pythonClientLoadError', error: message });
  }

  sendPythonState(
    state: PythonStateType,
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
}

export const pythonClient = new PythonClient();
