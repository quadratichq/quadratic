import { getPromptMessages } from 'quadratic-shared/ai/helpers/message.helper';
import { Chat, ChatSchema } from 'quadratic-shared/typesAndSchemasAI';

const DB_NAME = 'Quadratic-AI';
const DB_VERSION = 1;
const DB_STORE = 'aiAnalystChats';

class AIAnalystOfflineChats {
  private db?: IDBDatabase;
  userEmail?: string;
  fileId?: string;

  init = (userEmail: string, fileId: string): Promise<undefined> => {
    return new Promise((resolve, reject) => {
      this.userEmail = userEmail;
      this.fileId = fileId;
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = (event) => {
        console.error('Error opening indexedDB', event);
        reject(new Error('Failed to open database'));
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve(undefined);
      };

      request.onupgradeneeded = (event) => {
        try {
          const db = request.result;
          const objectStore = db.createObjectStore(DB_STORE, {
            keyPath: ['userEmail', 'fileId', 'id'],
          });
          objectStore.createIndex('userEmail', 'userEmail');
          objectStore.createIndex('fileId', 'fileId');
        } catch (error) {
          console.error('Error during database upgrade:', error);
          reject(error);
        }
      };
    });
  };

  // Helper method to validate required properties
  private validateState = (methodName: string) => {
    if (!this.db || !this.userEmail || !this.fileId) {
      throw new Error(`Expected db, userEmail and fileId to be set in ${methodName} method.`);
    }
    return { db: this.db, userEmail: this.userEmail, fileId: this.fileId };
  };

  // Helper method to create transactions
  private createTransaction = (mode: IDBTransactionMode, operation: (store: IDBObjectStore) => void): Promise<void> => {
    const { db } = this.validateState('transaction');

    return new Promise((resolve, reject) => {
      const tx = db.transaction(DB_STORE, mode);
      const store = tx.objectStore(DB_STORE);

      tx.oncomplete = () => resolve(undefined);
      tx.onerror = () => reject(tx.error);

      operation(store);
    });
  };

  // Load all chats for current user
  loadChats = (): Promise<Chat[]> => {
    const { db, userEmail, fileId } = this.validateState('loadChats');

    return new Promise((resolve, reject) => {
      try {
        const tx = db.transaction(DB_STORE, 'readonly');
        const store = tx.objectStore(DB_STORE).index('userEmail');
        const keyRange = IDBKeyRange.only(userEmail);
        const getAll = store.getAll(keyRange);

        getAll.onsuccess = () => {
          let chats = getAll.result
            .filter((chat) => chat.fileId === fileId)
            .map(({ userEmail, fileId, ...chat }) => chat);
          chats = chats.filter((chat) => {
            if (ChatSchema.safeParse(chat).success) {
              return true;
            } else {
              // delete chat if it is not valid or schema has changed
              this.deleteChats([chat.id]).catch((error) => {
                console.error('[AIAnalystOfflineChats] loadChats: ', error);
              });
              return false;
            }
          });
          resolve(chats);
        };
        getAll.onerror = () => {
          console.error('Error loading chats:', getAll.error);
          reject(new Error('Failed to load chats'));
        };

        tx.onerror = () => {
          console.error('Transaction error:', tx.error);
          reject(new Error('Transaction failed while loading chats'));
        };
      } catch (error) {
        console.error('Unexpected error in loadChats:', error);
        reject(error);
      }
    });
  };

  // Save or update a chat
  saveChats = async (chats: Chat[]) => {
    const { userEmail, fileId } = this.validateState('saveChats');
    await this.createTransaction('readwrite', (store) => {
      chats.forEach((chat) => {
        const chatEntry = {
          userEmail,
          fileId,
          ...{
            ...chat,
            messages: getPromptMessages(chat.messages),
          },
        };
        store.put(chatEntry);
      });
    });
  };

  // Delete a list of chats
  deleteChats = async (chatIds: string[]) => {
    const { userEmail, fileId } = this.validateState('deleteChats');
    await this.createTransaction('readwrite', (store) => {
      chatIds.forEach((chatId) => {
        store.delete([userEmail, fileId, chatId]);
      });
    });
  };

  // Delete all chats for a file
  deleteFile = async (userEmail: string, fileId: string) => {
    if (this.userEmail !== userEmail || this.fileId !== fileId) {
      await this.init(userEmail, fileId);
    }
    const chats = await this.loadChats();
    const chatIds = chats.map((chat) => chat.id);
    await this.deleteChats(chatIds);
  };

  // Used by tests to clear all entries from the indexedDb for this fileId
  testClear = async () => {
    await this.createTransaction('readwrite', (store) => {
      store.clear();
    });
  };
}

export const aiAnalystOfflineChats = new AIAnalystOfflineChats();
