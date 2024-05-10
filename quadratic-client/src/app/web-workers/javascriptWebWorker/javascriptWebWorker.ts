import { events } from '@/app/events/events';
import mixpanel from 'mixpanel-browser';
import { LanguageState } from '../languageTypes';
import { quadraticCore } from '../quadraticCore/quadraticCore';
import { ClientJavascriptMessage, JavascriptClientMessage } from './javascriptClientMessages';

class JavascriptWebWorker {
  state: LanguageState = 'loading';

  private worker?: Worker;

  private send(message: ClientJavascriptMessage, port?: MessagePort) {
    if (!this.worker) throw new Error('Expected worker to be defined in javascript.ts');
    if (port) {
      this.worker.postMessage(message, [port]);
    } else {
      this.worker.postMessage(message);
    }
  }

  private handleMessage = (message: MessageEvent<JavascriptClientMessage>) => {
    switch (message.data.type) {
      case 'javascriptClientInit':
        this.state = 'ready';
        events.emit('javascriptInit', message.data.version);
        break;

      case 'javascriptClientState':
        this.state = message.data.state;
        events.emit('javascriptState', message.data.state, message.data.current, message.data.awaitingExecution);
        break;

      default:
        throw new Error(`Unhandled message type ${message.type}`);
    }
  };

  init() {
    this.worker = new Worker(new URL('./worker/javascript.worker.ts', import.meta.url), { type: 'module' });
    this.worker.onmessage = this.handleMessage;

    const JavascriptCoreChannel = new MessageChannel();
    this.send({ type: 'clientJavascriptCoreChannel' }, JavascriptCoreChannel.port1);
    quadraticCore.sendJavascriptInit(JavascriptCoreChannel.port2);
  }

  cancelExecution = () => {
    mixpanel.track('[JavascriptWebWorker].restartFromUser');

    if (!this.worker) throw new Error('Expected worker to be defined in Javascript.ts');
    this.worker.terminate();
    quadraticCore.sendCancelExecution('Javascript');
    this.init();
    events.emit('javascriptState', 'ready');
  };
}

export const javascriptWebWorker = new JavascriptWebWorker();
