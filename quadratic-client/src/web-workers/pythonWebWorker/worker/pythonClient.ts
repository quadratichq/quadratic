import { debugWebWorkers, debugWebWorkersMessages } from '@/debugFlags';
import { ClientPythonMessage, CodeRun, PythonClientMessage, PythonStateType } from '../pythonClientMessages';
import { pythonCore } from './pythonCore';

declare var self: WorkerGlobalScope & typeof globalThis & {};

class PythonClient {
  start() {
    self.onmessage = this.handleMessage;
    if (debugWebWorkers) console.log('[pythonClient] initialized.');
  }

  private send(message: PythonClientMessage) {
    self.postMessage(message);
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
    options?: { version?: string; error?: string; current?: CodeRun; awaitingExecution?: CodeRun[] }
  ) {
    this.send({
      type: 'pythonClientState',
      state,
      version: options?.version,
      error: options?.error,
      current: options?.current,
      awaitingExecution: options?.awaitingExecution,
    });
  }
}

export const pythonClient = new PythonClient();
