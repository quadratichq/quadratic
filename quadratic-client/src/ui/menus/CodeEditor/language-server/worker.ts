import { createMessageConnection } from 'vscode-jsonrpc';
import { BrowserMessageReader, BrowserMessageWriter } from 'vscode-jsonrpc/browser';
import { LogMessageNotification, RegistrationRequest } from 'vscode-languageserver-protocol';
import { LanguageServerClient } from './client';

// avoid worker caching
const workerScriptName = './pyright.worker.js?' + Math.random().toString(36).substring(2, 20);

export const uri = 'file:///src/main.py';

const pyright = (uri: string): LanguageServerClient | undefined => {
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

  // start listenen for messages
  connection.listen();

  const client = new LanguageServerClient(connection, '');

  connection.onUnhandledNotification(
    (params: any) => params.message && console.log('[Pyright WebWorker] Unhandled: ', params.message)
  );
  
  connection.onNotification(LogMessageNotification.type, (params) =>
    console.log('[Pyright WebWorker] Log: ', params.message)
  );
  
  connection.onRequest(RegistrationRequest.type, () => {});

  client.initialize().then(() => console.log('[Pyright WebWorker] Initialized'));

  return client;
};

export const pyrightWorker = pyright(uri);
