import type { DbFile, FromIframeMessages, ToIframeMessages } from '@/app/ai/iframeAiChatFiles/IframeMessages';
import { sendAnalyticsError } from '@/shared/utils/error';
import { Dexie, type Table } from 'dexie';

const DB_NAME = 'Iframe-AI-Chat-Files';
const DB_VERSION = 1;
const DB_STORE = 'iframeAiChatFiles';

declare const parent: Window | null;

// [chatId, fileId]
type ChatFileKey = [string, string];

class IframeAiChatFiles {
  private db?: Dexie;
  private filesTable?: Table<DbFile, ChatFileKey>;

  constructor() {
    try {
      this.db = new Dexie(DB_NAME);
      this.db.version(DB_VERSION).stores({
        [DB_STORE]: '[chatId+fileId], chatId, fileId',
      });

      this.filesTable = this.db.table(DB_STORE);

      this.db
        .open()
        .then(() => {
          this.setUpEventListeners();
        })
        .catch((error) => {
          this.sendAnalyticsError('init', error);
        });
    } catch (error) {
      this.sendAnalyticsError('init', error);
    }
  }

  private sendAnalyticsError = (from: string, error: Error | unknown) => {
    sendAnalyticsError('IframeAiChatFiles', from, error);
  };

  private setUpEventListeners = () => {
    try {
      if (parent) {
        window.addEventListener('message', this.handleMessage);
        parent.postMessage({ type: 'iframe-indexeddb-ready' }, '*');
      } else {
        this.sendAnalyticsError('setUpEventListeners', new Error('parent is null'));
      }
    } catch (error) {
      this.sendAnalyticsError('setUpEventListeners', error);
    }
  };

  private handleMessage = async (event: MessageEvent<ToIframeMessages>) => {
    try {
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
            this.sendAnalyticsError('save-files', error);
            this.sendMessage({ type: 'save-files-response', success: false, dbFiles: [], error: error }, event.origin);
          }
          break;
        case 'get-files':
          try {
            const dbFiles = await this.getFiles(event.data.chatId);
            const transferables = dbFiles.map((dbFile) => dbFile.data);
            this.sendMessage({ type: 'get-files-response', dbFiles }, event.origin, transferables);
          } catch (error) {
            this.sendAnalyticsError('get-files', error);
            this.sendMessage({ type: 'get-files-response', dbFiles: [], error: error }, event.origin);
          }
          break;
        case 'delete-files':
          try {
            const deletedFileIds = await this.deleteFiles(event.data.chatId, event.data.fileIds);
            this.sendMessage({ type: 'delete-files-response', success: true, fileIds: deletedFileIds }, event.origin);
          } catch (error) {
            this.sendAnalyticsError('delete-files', error);
            this.sendMessage(
              { type: 'delete-files-response', success: false, fileIds: [], error: error },
              event.origin
            );
          }
          break;
      }
    } catch (error) {
      this.sendAnalyticsError('handleMessage', error);
    }
  };

  private sendMessage = (message: FromIframeMessages, origin: string, transferables?: Transferable[]) => {
    try {
      if (!parent) {
        this.sendAnalyticsError('sendMessage', new Error('parent is null'));
        return;
      }

      if (transferables) {
        parent.postMessage(message, origin, transferables);
      } else {
        parent.postMessage(message, origin);
      }
    } catch (error) {
      this.sendAnalyticsError('sendMessage', error);
    }
  };

  private validateState = (methodName: string): { db: Dexie; filesTable: Table<DbFile, [string, string]> } => {
    if (!this.db || !this.filesTable) {
      throw new Error(`Expected db and filesTable to be set in ${methodName} method.`);
    }

    return { db: this.db, filesTable: this.filesTable };
  };

  private saveFiles = async (dbFiles: DbFile[]): Promise<DbFile[]> => {
    try {
      const { filesTable } = this.validateState('saveFiles');

      await filesTable.bulkPut(dbFiles);

      return dbFiles;
    } catch (error) {
      this.sendAnalyticsError('saveFiles', error);
      return [];
    }
  };

  private getFiles = async (chatId: string): Promise<DbFile[]> => {
    try {
      const { filesTable } = this.validateState('getFiles');

      const dbFiles = await filesTable.where('chatId').equals(chatId).toArray();

      await this.clearStore();

      return dbFiles;
    } catch (error) {
      this.sendAnalyticsError('getFiles', error);
      return [];
    }
  };

  private deleteFiles = async (chatId: string, fileIds: string[]): Promise<string[]> => {
    try {
      const { filesTable } = this.validateState('deleteFiles');

      const keysToDelete = fileIds.map<ChatFileKey>((fileId) => [chatId, fileId]);

      await filesTable.bulkDelete(keysToDelete);

      return fileIds;
    } catch (error) {
      this.sendAnalyticsError('deleteFiles', error);
      return [];
    }
  };

  private clearStore = async () => {
    try {
      const { filesTable } = this.validateState('clearStore');

      await filesTable.clear();
    } catch (error) {
      this.sendAnalyticsError('clearStore', error);
    }
  };
}

export const iframeAiChatFiles = new IframeAiChatFiles();
