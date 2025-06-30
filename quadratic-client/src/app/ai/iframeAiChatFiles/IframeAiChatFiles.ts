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
    switch (event.data.type) {
      case 'save-files':
        try {
          const savedFiles = await this.saveFiles(event.data.dbFiles);
          const transferables = savedFiles.map((dbFile) => dbFile.data);
          this.sendMessage(
            { type: 'save-files-response', success: true, dbFiles: savedFiles },
            event.origin,
            transferables
          );
        } catch (error) {
          console.error('[IframeAiChatFiles] Error saving files:', error);
          this.sendMessage({ type: 'save-files-response', success: false, dbFiles: [], error: error }, event.origin);
        }
        break;
      case 'get-files':
        try {
          const dbFiles = await this.getFiles(event.data.chatId);
          const transferables = dbFiles.map((dbFile) => dbFile.data);
          this.sendMessage({ type: 'get-files-response', dbFiles }, event.origin, transferables);
        } catch (error) {
          this.sendMessage({ type: 'get-files-response', dbFiles: [], error: error }, event.origin);
        }
        break;
      case 'delete-files':
        try {
          const deletedFileIds = await this.deleteFiles(event.data.chatId, event.data.fileIds);
          this.sendMessage({ type: 'delete-files-response', success: true, fileIds: deletedFileIds }, event.origin);
        } catch (error) {
          this.sendMessage({ type: 'delete-files-response', success: false, fileIds: [], error: error }, event.origin);
        }
        break;
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

  private saveFiles = async (dbFiles: DbFile[]): Promise<DbFile[]> => {
    try {
      const { db } = this.validateState('saveFiles');

      const savedFiles = await new Promise<DbFile[]>((resolve, reject) => {
        const tx = db.transaction(DB_STORE, 'readwrite');
        const store = tx.objectStore(DB_STORE);
        const savedFiles: DbFile[] = [];

        tx.oncomplete = () => resolve(savedFiles);
        tx.onerror = () => reject(tx.error);

        dbFiles.forEach((dbFile) => {
          const request = store.put(dbFile);
          request.onsuccess = () => {
            savedFiles.push(dbFile);
          };
          request.onerror = () => {
            console.error('[IframeAiChatFiles] Error saving file:', request.error);
          };
        });
      });

      return savedFiles;
    } catch (error) {
      console.error('[IframeAiChatFiles] Error in saveFiles:', error);
      return [];
    }
  };

  private getFiles = async (chatId: string): Promise<DbFile[]> => {
    try {
      const { db } = this.validateState('getFiles');

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

      await this.clearStore();

      return dbFiles;
    } catch (error) {
      console.error('[IframeAiChatFiles] Error in getFiles:', error);
      return [];
    }
  };

  private deleteFiles = async (chatId: string, fileIds: string[]): Promise<string[]> => {
    try {
      const { db } = this.validateState('deleteFiles');

      const deletedFileIds = await new Promise<string[]>((resolve, reject) => {
        const tx = db.transaction(DB_STORE, 'readwrite');
        const store = tx.objectStore(DB_STORE);
        let completed = 0;
        const deletedFileIds: string[] = [];

        tx.onerror = () => reject(tx.error);

        fileIds.forEach((fileId) => {
          const request = store.delete([chatId, fileId]);

          request.onsuccess = () => {
            completed++;
            deletedFileIds.push(fileId);
            if (completed === fileIds.length) {
              resolve(deletedFileIds);
            }
          };

          request.onerror = () => {
            console.error('[IframeAiChatFiles] Error deleting file:', fileId, request.error);
            completed++;
            if (completed === fileIds.length) {
              resolve(deletedFileIds);
            }
          };
        });
      });

      return deletedFileIds;
    } catch (error) {
      console.error('[IframeAiChatFiles] Error in deleteFiles:', error);
      return [];
    }
  };

  private clearStore = async () => {
    try {
      const { db } = this.validateState('clearStore');

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
    } catch (error) {
      console.error('[IframeAiChatFiles] Error in clearStore:', error);
    }
  };
}

export const iframeAiChatFiles = new IframeAiChatFiles();
