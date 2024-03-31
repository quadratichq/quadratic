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
      case 'pythonClientState':
        this.state = message.data.state;
        events.emit(
          'pythonState',
          message.data.state,
          message.data.version,
          message.data.current,
          message.data.awaitingExecution
        );
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

  stop() {
    if (this.worker) {
      this.worker.terminate();
    }
  }

  restart() {
    this.stop();
    this.init();
  }

  restartFromUser() {
    mixpanel.track('[PythonWebWorker].restartFromUser');

    // todo...
    // const transactionId = this.getTransactionId();

    // this.restart();
    // const result: JsCodeResult = {
    //   transaction_id: transactionId,
    //   success: false,
    //   formatted_code: null,
    //   error_msg: 'Python execution cancelled by user',
    //   input_python_std_out: null,
    //   output_value: null,
    //   array_output: null,
    //   line_number: null,
    //   output_type: null,
    //   cancel_compute: true,
    // };
    // // grid.calculationComplete(result);
    // console.log(result);
    // debugger;
    // this.calculationComplete();
  }
}

export const pythonWebWorker = new PythonWebWorker();
