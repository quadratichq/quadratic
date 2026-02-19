import { events } from '@/app/events/events';
import { getIsEmbedMode } from '@/app/helpers/sharedArrayBufferSupport';
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
  private initPromise?: Promise<void>;
  private initReject?: (error: Error) => void;

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
    try {
      this.worker = new Worker(new URL('./worker/javascript.worker.ts', import.meta.url), { type: 'module' });
      this.worker.onmessage = this.handleMessage;
      this.worker.onerror = (error) => {
        console.error('[javascriptWebWorker] Worker error:', error);
        const errorObj = error.error || new Error('JavaScript worker error');
        if (this.initReject) {
          this.initReject(errorObj);
          this.initReject = undefined;
        }
      };

      const JavascriptCoreChannel = new MessageChannel();
      this.send(
        { type: 'clientJavascriptCoreChannel', env: import.meta.env, isEmbedMode: getIsEmbedMode() },
        JavascriptCoreChannel.port1
      );
      quadraticCore.sendJavascriptInit(JavascriptCoreChannel.port2);
    } catch (error) {
      if (this.initReject) {
        this.initReject(error instanceof Error ? error : new Error(String(error)));
        this.initReject = undefined;
      }
      throw error;
    }
  }

  isInitialized(): boolean {
    return this.worker !== undefined;
  }

  async ensureInitialized(): Promise<void> {
    if (this.worker && this.state === 'ready') {
      return;
    }

    if (this.initPromise) {
      return this.initPromise;
    }

    // Emit loading event when initialization starts
    events.emit('javascriptLoading');

    this.initPromise = new Promise<void>((resolve, reject) => {
      this.initReject = reject;

      const timeout = setTimeout(() => {
        events.off('javascriptInit', onInit);
        this.initPromise = undefined;
        this.initReject = undefined;
        reject(new Error('JavaScript worker initialization timed out'));
      }, 30000); // 30 second timeout

      const onInit = () => {
        clearTimeout(timeout);
        events.off('javascriptInit', onInit);
        this.initPromise = undefined;
        this.initReject = undefined;
        resolve();
      };

      events.on('javascriptInit', onInit);

      try {
        this.initWorker();
      } catch (error) {
        clearTimeout(timeout);
        events.off('javascriptInit', onInit);
        this.initPromise = undefined;
        this.initReject = undefined;
        reject(error);
      }
    });

    return this.initPromise;
  }

  cancelExecution = () => {
    trackEvent('[JavascriptWebWorker].restartFromUser');
    this.initWorker();
    quadraticCore.sendCancelExecution('Javascript');
  };
}

export const javascriptWebWorker = new JavascriptWebWorker();
