import type { DbFile, FromIframeMessages, ToIframeMessages } from '@/app/ai/iframeAiChatFiles/IframeMessages';
import { events } from '@/app/events/events';

// const IFRAME_ORIGIN = 'https://quadratic-website-git-ayush-iframfiletransfer.vercel.quadratic-preview.com';
const IFRAME_ORIGIN = window.location.origin;

export const IMPORT_FILE_EXTENSIONS = ['xlsx', 'xls', 'csv', 'parquet', 'parq', 'pqt'];

class FilesFromIframe {
  private iframe?: HTMLIFrameElement;
  private chatId?: string;
  dbFiles: DbFile[] = [];

  init(chatId: string) {
    this.chatId = chatId;

    window.addEventListener('message', this.handleMessage);

    this.iframe = document.createElement('iframe');
    this.iframe.src = `${window.location.origin}/iframe-indexeddb`;
    this.iframe.style.display = 'none';
    this.iframe.setAttribute('sandbox', 'allow-same-origin allow-scripts allow-storage-access-by-user-activation');

    this.iframe.onload = () => {
      console.log('Iframe loaded');
    };

    this.iframe.onerror = (error) => {
      console.error('Iframe failed to load:', error);
    };

    document.body.appendChild(this.iframe);
    console.log('iframe', this.iframe);
  }

  private handleMessage = (event: MessageEvent<FromIframeMessages>) => {
    if (event.origin !== window.location.origin) {
      return;
    }

    switch (event.data.type) {
      case 'iframe-indexeddb-ready':
        console.log('Iframe indexeddb ready');
        this.getFiles();
        break;
      case 'get-files-response':
        console.log('Files received:', event.data);
        this.handleGetFiles(event.data);
        break;
      default:
        console.log('Unknown message type:', event.data);
    }
  };

  private sendMessage = (message: ToIframeMessages, transferables?: Transferable[]) => {
    if (!this.iframe) {
      throw new Error('Iframe is not set');
    }
    if (transferables) {
      this.iframe.contentWindow?.postMessage(message, IFRAME_ORIGIN, transferables);
    } else {
      this.iframe.contentWindow?.postMessage(message, IFRAME_ORIGIN);
    }
  };

  private getFiles = () => {
    if (!this.chatId) {
      throw new Error('Chat ID is not set');
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
