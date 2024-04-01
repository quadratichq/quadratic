import { events } from '@/events/events';
import mixpanel from 'mixpanel-browser';
import { quadraticCore } from '../quadraticCore/quadraticCore';
import { ClientPythonMessage, PythonClientMessage, PythonStateType } from './pythonClientMessages';

class PythonWebWorker {
  state: PythonStateType = 'loading';

  private worker?: Worker;

  private send(message: ClientPythonMessage, port?: MessagePort) {
    if (!this.worker) throw new Error('Expected worker to be defined in python.ts');
    if (port) {
      this.worker.postMessage(message, [port]);
    } else {
      this.worker.postMessage(message);
    }
  }

  private handleMessage = (message: MessageEvent<PythonClientMessage>) => {
    switch (message.data.type) {
      case 'pythonClientInit':
        this.state = 'ready';
        events.emit('pythonInit', message.data.version);
        break;

      case 'pythonClientState':
        this.state = message.data.state;
        events.emit('pythonState', message.data.state, message.data.current, message.data.awaitingExecution);
        break;

      default:
        throw new Error(`Unhandled message type ${message.type}`);
    }
  };

  init() {
    this.worker = new Worker(new URL('./worker/python.worker.ts', import.meta.url), { type: 'module' });
    this.worker.onmessage = this.handleMessage;

    const pythonCoreChannel = new MessageChannel();
    this.send({ type: 'clientPythonCoreChannel' }, pythonCoreChannel.port1);
    quadraticCore.sendPythonInit(pythonCoreChannel.port2);
  }

  cancelExecution() {
    mixpanel.track('[PythonWebWorker].restartFromUser');

    if (!this.worker) throw new Error('Expected worker to be defined in python.ts');
    this.worker.terminate();
    quadraticCore.sendCancelExecution('Python');
    this.init();
    events.emit('pythonState', 'loading');
  }
}

export const pythonWebWorker = new PythonWebWorker();
