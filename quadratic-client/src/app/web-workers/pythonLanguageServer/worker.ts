import { debugFlag } from '@/app/debugFlags/debugFlags';
import { LanguageServerClient } from '@/app/web-workers/pythonLanguageServer/client';
import { BrowserMessageReader, BrowserMessageWriter } from 'vscode-jsonrpc/browser';
import { createMessageConnection, LogMessageNotification, RegistrationRequest } from 'vscode-languageserver-protocol';

// avoid worker caching
const workerScriptName = '/pyright.worker.js?url' + Math.random().toString(36).substring(2, 20);

export const uri = 'file:///src/main.py';

const pyright = (uri: string, enableLogging: boolean = false): LanguageServerClient | undefined => {
  const workerScriptUrl = new URL(workerScriptName, import.meta.url).toString();
  const foreground = new Worker(workerScriptUrl);
  const workers = [foreground];
  let backgroundWorkerCount = 0;

  foreground.postMessage({
    type: 'browser/boot',
    mode: 'foreground',
  });

  const connection = createMessageConnection(
    new BrowserMessageReader(foreground),
    new BrowserMessageWriter(foreground)
  );

  connection.onDispose(() => workers.forEach((w) => w.terminate()));

  // Listen for a 'browser/newWorker' from the foreground worker, creating a
  // new background worker for each request.
  foreground.addEventListener('message', (e: MessageEvent) => {
    if (e.data && e.data.type === 'browser/newWorker') {
      const { initialData, port } = e.data;
      const background = new Worker(workerScriptUrl, {
        name: `Pyright-background-${++backgroundWorkerCount}`,
      });

      workers.push(background);

      background.postMessage(
        {
          type: 'browser/boot',
          mode: 'background',
          initialData,
          port,
        },
        [port]
      );

      background.addEventListener('message', (e: MessageEvent) => {
        // console.log('received background message', e.data);
      });
    }
  });

  // start listening for messages
  connection.listen();

  const client = new LanguageServerClient(connection, '');

  connection.onUnhandledNotification((params: any) => params.message && log(params.message, enableLogging));

  connection.onNotification(LogMessageNotification.type, (params) => log(params.message, enableLogging));

  connection.onRequest(RegistrationRequest.type, () => {});

  client.initialize().then(() => {
    if (debugFlag('debugWebWorkers')) {
      log('Initialized', true);
    }
  });

  return client;
};

function log(message: string, enableLogging: boolean) {
  if (enableLogging) {
    console.log('[Pyright WebWorker] ', message);
  }
}

export const pyrightWorker = pyright(uri);
