import { createMessageConnection } from 'vscode-jsonrpc';
import { BrowserMessageReader, BrowserMessageWriter } from 'vscode-jsonrpc/browser';
import { DidOpenTextDocumentNotification } from 'vscode-languageserver-protocol';
import { CreateFile } from 'vscode-languageserver-types';
import { LanguageServerClient } from './client';

const workerScriptName = './pyright.worker.js?' + Math.random().toString(36).substring(2,20);
let version = 0;
let client: LanguageServerClient;

export function nextVersion(): number {
  return version + 1;
}

export const uri = "file:///src/main.py";

export const pyright = (uri: string): LanguageServerClient | undefined => {
  const workerScriptUrl = new URL(workerScriptName, import.meta.url).toString();
  const foreground = new Worker(workerScriptUrl);
  foreground.postMessage({
    type: 'browser/boot',
    mode: 'foreground',
  });
  const connection = createMessageConnection(
    new BrowserMessageReader(foreground),
    new BrowserMessageWriter(foreground)
  );
  const workers: Worker[] = [foreground];
  connection.onDispose(() => {
    workers.forEach((w) => w.terminate());
  });

  let backgroundWorkerCount = 0;
  foreground.addEventListener('message', (e: MessageEvent) => {
    // console.log('received foreground message', e.data);
    // console.log('allDiagnostics()', client.allDiagnostics());
    if (e.data && e.data.type === 'browser/newWorker') {
      // Create a new background worker.
      // The foreground worker has created a message channel and passed us
      // a port. We create the background worker and pass transfer the port
      // onward.
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
  connection.listen();

  // connection.onNotification(null, (params: any) =>
  //     console.log("[LS]", params.message)
  //   );

  connection.onUnhandledNotification((params: any) => params.message && console.log('[Pyright WebWorker]', params.message));  

  client = new LanguageServerClient(connection, "file:///src");

  client.initialize().then(() => console.log('[Pyright WebWorker] initialized'));
  
  const params: CreateFile = {
    uri,
    kind: "create",
  };
  connection.sendNotification("pyright/createFile", params);
  connection.sendNotification(DidOpenTextDocumentNotification.type, {
    textDocument: {
      languageId: "python",
      text: "",
      uri,
      version: nextVersion(),
    }
  });

  return client;
};

export const pyrightWorker = pyright(uri);
