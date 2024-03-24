import { debugWebWorkers } from '@/debugFlags';
import { CorePythonMessage, PythonCoreMessage } from '../../pythonWebWorker/pythonCoreMessages';
import { core } from './core';

declare var self: WorkerGlobalScope &
  typeof globalThis & {
    jsRunPython: (transactionId: string, x: number, y: number, sheetId: string, code: string) => void;
  };

class CorePython {
  private corePythonPort?: MessagePort;

  init(pythonPort: MessagePort) {
    this.corePythonPort = pythonPort;
    this.corePythonPort.onmessage = this.handleMessage;
    if (debugWebWorkers) console.log('[corePython] initialized');
  }

  private handleMessage = (e: MessageEvent<PythonCoreMessage>) => {
    switch (e.data.type) {
      case 'pythonCoreResults':
        core.calculationComplete(e.data.transactionId, e.data.results);
        break;

      default:
        console.warn('[corePython] Unhandled message type', e.data);
    }
  };

  private send(message: CorePythonMessage) {
    if (!this.corePythonPort) {
      console.warn('Expected corePythonPort to be defined in CorePython.send');
      return;
    }
    this.corePythonPort.postMessage(message);
  }

  sendRunPython = (transactionId: string, x: number, y: number, sheetId: string, code: string) => {
    this.send({
      type: 'corePythonRun',
      transactionId,
      x,
      y,
      sheetId,
      code,
    });
  };
}

export const corePython = new CorePython();

self.jsRunPython = corePython.sendRunPython;
