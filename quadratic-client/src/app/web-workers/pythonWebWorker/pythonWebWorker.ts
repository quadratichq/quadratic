import { events } from '@/app/events/events';
import type { LanguageState } from '@/app/web-workers/languageTypes';
import type {
  ClientPythonMessage,
  PythonClientCaptureChartImage,
  PythonClientGetJwt,
  PythonClientMessage,
} from '@/app/web-workers/pythonWebWorker/pythonClientMessages';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { authClient } from '@/auth/auth';
import { trackEvent } from '@/shared/utils/analyticsEvents';

const CHART_IMAGE_TIMEOUT_MS = 10000;

class PythonWebWorker {
  state: LanguageState = 'loading';

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
        this.send({ type: 'clientPythonInit', env: import.meta.env });
        break;

      case 'pythonClientState':
        this.state = message.data.state;
        break;

      case 'pythonClientGetJwt':
        authClient.getTokenOrRedirect(true).then((jwt) => {
          const data = message.data as PythonClientGetJwt;
          this.send({ type: 'clientPythonGetJwt', id: data.id, jwt });
        });
        break;

      case 'pythonClientCaptureChartImage':
        this.captureChartImage(message.data as PythonClientCaptureChartImage);
        break;

      default:
        throw new Error(`Unhandled message type ${message.type}`);
    }
  };

  private captureChartImage = async (data: PythonClientCaptureChartImage) => {
    const { id, html, width, height } = data;
    let image: string | null = null;

    try {
      image = await this.renderChartToImage(html, width, height);
    } catch (e) {
      console.error('[pythonWebWorker] Failed to capture chart image:', e);
    }

    this.send({ type: 'clientPythonChartImage', id, image });
  };

  private renderChartToImage = (html: string, width: number, height: number): Promise<string | null> => {
    return new Promise((resolve) => {
      const startTime = Date.now();
      const iframe = document.createElement('iframe');
      iframe.style.position = 'absolute';
      iframe.style.left = '-9999px';
      iframe.style.top = '-9999px';
      iframe.style.width = `${width}px`;
      iframe.style.height = `${height}px`;
      iframe.style.border = 'none';
      iframe.style.visibility = 'hidden';

      let resolved = false;
      const cleanup = () => {
        if (iframe.parentNode) {
          iframe.parentNode.removeChild(iframe);
        }
      };

      const timeoutId = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          cleanup();
          resolve(null);
        }
      }, CHART_IMAGE_TIMEOUT_MS);

      iframe.onload = async () => {
        try {
          const contentWindow = iframe.contentWindow;
          if (!contentWindow) {
            throw new Error('No content window');
          }

          const remainingTimeout = Math.max(0, CHART_IMAGE_TIMEOUT_MS - (Date.now() - startTime));
          const plotly = await this.waitForPlotly(contentWindow, remainingTimeout);
          if (!plotly) {
            throw new Error('Plotly not available');
          }

          const plotElement = contentWindow.document.querySelector('.js-plotly-plot');
          if (!plotElement) {
            throw new Error('No Plotly element found');
          }

          const dataUrl = await plotly.toImage(plotElement, {
            format: 'webp',
            width,
            height,
          });

          if (!resolved) {
            resolved = true;
            clearTimeout(timeoutId);
            cleanup();
            resolve(dataUrl);
          }
        } catch (e) {
          console.error('[pythonWebWorker] Error capturing chart:', e);
          if (!resolved) {
            resolved = true;
            clearTimeout(timeoutId);
            cleanup();
            resolve(null);
          }
        }
      };

      iframe.onerror = (e) => {
        console.error('[pythonWebWorker] Iframe failed to load:', e);
        if (!resolved) {
          resolved = true;
          clearTimeout(timeoutId);
          cleanup();
          resolve(null);
        }
      };

      iframe.srcdoc = html;
      document.body.appendChild(iframe);
    });
  };

  private waitForPlotly = (
    contentWindow: Window,
    timeoutMs: number
  ): Promise<{ toImage: (el: Element, opts: object) => Promise<string> } | null> => {
    return new Promise((resolve) => {
      const startTime = Date.now();

      const check = () => {
        const plotly = (contentWindow as any).Plotly;
        if (plotly && typeof plotly.toImage === 'function') {
          resolve(plotly);
          return;
        }

        if (Date.now() - startTime > timeoutMs) {
          resolve(null);
          return;
        }

        setTimeout(check, 50);
      };

      check();
    });
  };

  initWorker() {
    this.worker?.terminate();
    this.worker = new Worker(new URL('./worker/python.worker.ts', import.meta.url), { type: 'module' });
    this.worker.onmessage = this.handleMessage;

    const pythonCoreChannel = new MessageChannel();
    this.send({ type: 'clientPythonCoreChannel' }, pythonCoreChannel.port1);
    quadraticCore.sendPythonInit(pythonCoreChannel.port2);
  }

  cancelExecution = () => {
    trackEvent('[PythonWebWorker].restartFromUser');
    this.initWorker();
    quadraticCore.sendCancelExecution('Python');
  };
}

export const pythonWebWorker = new PythonWebWorker();
