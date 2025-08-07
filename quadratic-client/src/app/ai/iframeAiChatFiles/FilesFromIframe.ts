import type { DbFile, FromIframeMessages, ToIframeMessages } from '@/app/ai/iframeAiChatFiles/IframeMessages';
import { events } from '@/app/events/events';

const IFRAME_ORIGIN = window.location.origin;

export const IMPORT_FILE_EXTENSIONS = ['xlsx', 'xls', 'csv', 'parquet', 'parq', 'pqt'];

class FilesFromIframe {
  private iframe?: HTMLIFrameElement;
  private chatId?: string;
  dbFiles: DbFile[] = [];

  loadFiles(chatId: string) {
    this.chatId = chatId;

    window.addEventListener('message', this.handleMessage);

    this.iframe = document.createElement('iframe');
    this.iframe.src = `${IFRAME_ORIGIN}/iframe-indexeddb`;
    this.iframe.style.display = 'none';
    this.iframe.setAttribute('sandbox', 'allow-same-origin allow-scripts');

    this.iframe.onerror = (error) => {
      console.error('[FilesFromIframe] Iframe failed to load:', error);
    };

    document.body.appendChild(this.iframe);
  }

  private handleMessage = (event: MessageEvent<FromIframeMessages>) => {
    if (event.origin !== IFRAME_ORIGIN) {
      return;
    }

    switch (event.data.type) {
      case 'iframe-indexeddb-ready':
        this.getFiles();
        break;
      case 'get-files-response':
        this.handleGetFiles(event.data);
        break;
    }
  };

  private sendMessage = (message: ToIframeMessages, transferables?: Transferable[]) => {
    if (!this.iframe) {
      throw new Error('[FilesFromIframe] Iframe is not set');
    }
    if (transferables) {
      this.iframe.contentWindow?.postMessage(message, IFRAME_ORIGIN, transferables);
    } else {
      this.iframe.contentWindow?.postMessage(message, IFRAME_ORIGIN);
    }
  };

  private getFiles = () => {
    if (!this.chatId) {
      throw new Error('[FilesFromIframe] chatId is not set');
    }
    this.sendMessage({ type: 'get-files', chatId: this.chatId });
  };

  private handleGetFiles = (data: any) => {
    this.dbFiles = data.dbFiles;
    events.emit('filesFromIframeInitialized');

    // cleanup
    this.iframe?.remove();
    this.iframe = undefined;
    this.chatId = undefined;
    window.removeEventListener('message', this.handleMessage);
  };
}
export const filesFromIframe = new FilesFromIframe();
