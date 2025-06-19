import type { DbFile, FromIframeMessages, ToIframeMessages } from '@/app/ai/iframeAiChatFiles/IframeMessages';

const DB_NAME = 'Iframe-AI-Chat-Files';
const DB_VERSION = 1;
const DB_STORE = 'iframeAiChatFiles';

declare const parent: Window;

class IframeAiChatFiles {
  private db?: IDBDatabase;

  constructor() {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = (e) => {
      console.error('[IframeAiChatFiles] Error opening database', e);
    };
    request.onsuccess = () => {
      this.db = request.result;
      this.setUpEventListeners();
    };
    request.onupgradeneeded = () => {
      const db = request.result;
      const objectStore = db.createObjectStore(DB_STORE, {
        keyPath: ['chatId', 'fileId'],
      });
      objectStore.createIndex('chatId', 'chatId');
      objectStore.createIndex('fileId', 'fileId');
    };
  }

  private setUpEventListeners = () => {
    window.addEventListener('message', this.handleMessage);
    parent.postMessage({ type: 'iframe-indexeddb-ready' }, '*');
  };

  private handleMessage = async (event: MessageEvent<ToIframeMessages>) => {
    console.log('[IframeAiChatFiles] message from iframe', event.data);

    switch (event.data.type) {
      case 'save-files':
        try {
          await this.saveFiles(event.data.dbFiles);
          this.sendMessage({ type: 'save-files-response', success: true }, event.origin);
        } catch (error) {
          console.error('[IframeAiChatFiles] Error saving files:', error);
          this.sendMessage({ type: 'save-files-response', success: false, error: error }, event.origin);
        }
        break;
      case 'get-files':
        try {
          const dbFiles = await this.getFiles(event.data.chatId);
          parent.postMessage({ type: 'get-files-response', dbFiles }, event.origin);
        } catch (error) {
          console.error('[IframeAiChatFiles] Error getting files:', error);
          parent.postMessage({ type: 'get-files-response', dbFiles: [], error: error }, event.origin);
        }
        break;
      default:
        console.log('[IframeAiChatFiles] message from iframe', event.data);
    }
  };

  private sendMessage = (message: FromIframeMessages, origin: string, transferables?: Transferable[]) => {
    if (transferables) {
      parent.postMessage(message, origin, transferables);
    } else {
      parent.postMessage(message, origin);
    }
  };

  private validateState = (methodName: string): { db: IDBDatabase } => {
    if (!this.db) {
      throw new Error(`Expected db to be set in ${methodName} method.`);
    }
    return { db: this.db };
  };

  saveFiles = async (dbFiles: DbFile[]): Promise<string[]> => {
    const { db } = this.validateState('saveFiles');

    try {
      const fileIds = await new Promise<string[]>((resolve, reject) => {
        const tx = db.transaction(DB_STORE, 'readwrite');
        const store = tx.objectStore(DB_STORE);
        const savedFileIds: string[] = [];

        tx.oncomplete = () => resolve(savedFileIds);
        tx.onerror = () => reject(tx.error);

        dbFiles.forEach((dbFile) => {
          const request = store.put(dbFile);
          request.onsuccess = () => {
            savedFileIds.push(dbFile.fileId);
          };
          request.onerror = () => {
            console.error('[IframeAiChatFiles] Error saving file:', request.error);
          };
        });
      });
      return fileIds;
    } catch (error) {
      console.error('[IframeAiChatFiles] Error in saveFiles:', error);
      return [];
    }
  };

  deleteFiles = async (fileIds: string[]) => {
    const { db } = this.validateState('deleteFiles');

    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(DB_STORE, 'readwrite');
      const store = tx.objectStore(DB_STORE);
      let completed = 0;

      tx.onerror = () => reject(tx.error);

      fileIds.forEach((fileId) => {
        const request = store.delete(fileId);

        request.onsuccess = () => {
          completed++;
          if (completed === fileIds.length) {
            resolve();
          }
        };

        request.onerror = () => {
          console.error('[IframeAiChatFiles] Error deleting file:', fileId, request.error);
          completed++;
          if (completed === fileIds.length) {
            resolve();
          }
        };
      });
    });
  };

  getFiles = async (chatId: string): Promise<DbFile[]> => {
    const { db } = this.validateState('getFiles');

    try {
      const dbFiles = await new Promise<DbFile[]>((resolve, reject) => {
        const tx = db.transaction(DB_STORE, 'readwrite');
        const store = tx.objectStore(DB_STORE);

        tx.onerror = () => reject(tx.error);

        const index = store.index('chatId');
        const request = index.getAll(chatId);

        request.onsuccess = () => {
          resolve(request.result);
        };

        request.onerror = () => {
          console.error('[IframeAiChatFiles] Error getting files for chat:', chatId, request.error);
          reject(request.error);
        };
      });

      await this.deleteAllFiles();
      return dbFiles;
    } catch (error) {
      console.error('[IframeAiChatFiles] Error in getFiles:', error);
      return [];
    }
  };

  private deleteAllFiles = async () => {
    const { db } = this.validateState('deleteFiles');

    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(DB_STORE, 'readwrite');
      const store = tx.objectStore(DB_STORE);

      const request = store.clear();

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = () => {
        console.error('[IframeAiChatFiles] Error deleting all files:', request.error);
        reject(request.error);
      };

      tx.onerror = () => reject(tx.error);
    });
  };
}
export const iframeAiChatFiles = new IframeAiChatFiles();
