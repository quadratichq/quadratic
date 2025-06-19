import { events } from '@/app/events/events';

const IFRAME_ORIGIN = 'https://quadratic-website-git-ayush-iframfiletransfer.vercel.quadratic-preview.com';
// const IFRAME_ORIGIN = 'http://localhost:8080';

class FilesFromIframe {
  private iframe?: HTMLIFrameElement;
  private chatId?: string;
  dbFiles: any[] = [];

  init(chatId: string) {
    this.chatId = chatId;

    window.addEventListener('message', this.handleMessage);

    this.iframe = document.createElement('iframe');
    this.iframe.src = `${IFRAME_ORIGIN}/IframeIndexedDb`;
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

  private handleMessage = (event: MessageEvent) => {
    if (event.origin !== IFRAME_ORIGIN) {
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

  private getFiles = () => {
    console.log('getFiles', this.chatId);
    this.iframe?.contentWindow?.postMessage(
      {
        type: 'get-files',
        chatId: this.chatId,
      },
      IFRAME_ORIGIN
    );
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
