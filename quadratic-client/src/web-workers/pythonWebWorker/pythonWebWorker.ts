import { events } from '@/events/events';
import { SheetPosTS } from '@/gridGL/types/size';
import { multiplayer } from '@/web-workers/multiplayerWebWorker/multiplayer';
import mixpanel from 'mixpanel-browser';
import { quadraticCore } from '../quadraticCore/quadraticCore';
import { ClientPythonMessage, PythonClientMessage, PythonCodeRun } from './pythonClientMessages';

class PythonWebWorker {
  private worker?: Worker;
  private executionStack: PythonCodeRun[] = [];

  // private getTransactionId() {
  //   if (this.executionStack.length === 0) throw new Error('Expected executionStack to have at least 1 element');
  //   return this.executionStack[0].transactionId;
  // }

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
        events.emit('pythonState', message.data.state, message.data.version);
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

  getRunningCells(sheetId: string): SheetPosTS[] {
    return this.executionStack.filter((cell) => cell.sheetPos.sheetId === sheetId).map((cell) => cell.sheetPos);
  }

  getCodeRunning(): SheetPosTS[] {
    return this.executionStack.map((cell) => cell.sheetPos);
  }

  private showChange() {
    window.dispatchEvent(new CustomEvent('python-change'));
    multiplayer.sendCodeRunning(this.getCodeRunning());
  }

  // next(complete: boolean) {
  //   if (complete) {
  //     this.running = false;
  //   }

  //   if (!this.worker || !this.loaded || this.running) {
  //     this.showChange();
  //     return;
  //   }

  //   if (this.executionStack.length) {
  //     const first = this.executionStack[0];
  //     if (first) {
  //       if (!this.running) {
  //         this.running = true;
  //         window.dispatchEvent(new CustomEvent('python-computation-started'));
  //       }
  //     }
  //   } else if (complete) {
  //     window.dispatchEvent(new CustomEvent('python-computation-finished'));
  //   }

  //   this.showChange();
  // }

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
