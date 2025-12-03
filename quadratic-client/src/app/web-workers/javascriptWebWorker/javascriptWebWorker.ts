import { events } from '@/app/events/events';
import type {
  ClientJavascriptMessage,
  JavascriptClientGetJwt,
  JavascriptClientMessage,
} from '@/app/web-workers/javascriptWebWorker/javascriptClientMessages';
import type { LanguageState } from '@/app/web-workers/languageTypes';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { authClient } from '@/auth/auth';
import { trackEvent } from '@/shared/utils/analyticsEvents';

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
        // Note: Don't emit codeRunningState here - Rust sends the unified state via coreClientCodeRunningState
        // which includes all languages. Emitting here would overwrite the complete queue with only JS operations.
        break;

      case 'javascriptClientGetJwt':
        authClient.getTokenOrRedirect(true).then((jwt) => {
          const data = message.data as JavascriptClientGetJwt;
          this.send({ type: 'clientJavascriptGetJwt', id: data.id, jwt });
        });

        break;

      default:
        throw new Error(`Unhandled message type ${message.type}`);
    }
  };

  initWorker() {
    this.worker?.terminate();
    this.worker = new Worker(new URL('./worker/javascript.worker.ts', import.meta.url), { type: 'module' });
    this.worker.onmessage = this.handleMessage;

    const JavascriptCoreChannel = new MessageChannel();
    this.send({ type: 'clientJavascriptCoreChannel', env: import.meta.env }, JavascriptCoreChannel.port1);
    quadraticCore.sendJavascriptInit(JavascriptCoreChannel.port2);
  }

  cancelExecution = () => {
    trackEvent('[JavascriptWebWorker].restartFromUser');
    this.initWorker();
    quadraticCore.sendCancelExecution('Javascript');
  };
}

export const javascriptWebWorker = new JavascriptWebWorker();
