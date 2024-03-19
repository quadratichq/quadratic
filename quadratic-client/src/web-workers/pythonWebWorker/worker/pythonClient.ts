import { debugWebWorkers, debugWebWorkersMessages } from '@/debugFlags';
import { ClientPythonMessage, PythonClientMessage } from '../pythonClientMessages';

declare var self: WorkerGlobalScope & typeof globalThis & {};

class PythonClient {
  start() {
    if (debugWebWorkers) console.log('[pythonClient] initialized.');
  }

  private send(message: PythonClientMessage) {
    self.postMessage(message);
  }

  private handleMessage = async (e: MessageEvent<ClientPythonMessage>) => {
    if (debugWebWorkersMessages) console.log(`[coreClient] message: ${e.data.type}`);

    switch (e.data.type) {
    }
  };
}

export const pythonClient = new PythonClient();
