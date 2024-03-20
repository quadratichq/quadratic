import { debugWebWorkers } from '@/debugFlags';
import { CorePythonMessage, PythonCoreMessage } from '../../pythonWebWorker/pythonCoreMessages';

class CorePython {
  private corePythonPort?: MessagePort;

  init(pythonPort: MessagePort) {
    this.corePythonPort = pythonPort;
    this.corePythonPort.onmessage = this.handleMessage;
    if (debugWebWorkers) console.log('[corePython] initialized');
  }

  private handleMessage = (e: MessageEvent<PythonCoreMessage>) => {};

  private send(message: CorePythonMessage) {
    if (!this.corePythonPort) {
      console.warn('Expected corePythonPort to be defined in CorePython.send');
      return;
    }
    this.corePythonPort.postMessage(message);
  }
}

export const corePython = new CorePython();
