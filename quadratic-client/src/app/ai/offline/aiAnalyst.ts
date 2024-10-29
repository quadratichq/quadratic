import { Chat } from '@/app/atoms/aiAnalystAtom';

const DB_VERSION = 1;
export const DB_NAME = 'Quadratic-AI-Chats';
const DB_STORE = 'aiAnalystChats';

class AIAnalystOfflineChats {
  private db?: IDBDatabase;
  userEmail?: string;
  uuid?: string;

  init = (userEmail: string, uuid: string): Promise<undefined> => {
    return new Promise((resolve, reject) => {
      this.userEmail = userEmail;
      this.uuid = uuid;
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
            keyPath: ['userEmail', 'uuid', 'id'],
          });
          objectStore.createIndex('userEmail', 'userEmail');
          objectStore.createIndex('uuid', 'uuid');
        } catch (error) {
          console.error('Error during database upgrade:', error);
          reject(error);
        }
      };
    });
  };

  // Helper method to validate required properties
  private validateState = (methodName: string) => {
    if (!this.db || !this.userEmail || !this.uuid) {
      throw new Error(`Expected db, userEmail and uuid to be set in ${methodName} method.`);
    }
    return { db: this.db, userEmail: this.userEmail, uuid: this.uuid };
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
    const { db, userEmail, uuid } = this.validateState('loadChats');

    return new Promise((resolve, reject) => {
      try {
        const tx = db.transaction(DB_STORE, 'readonly');
        const store = tx.objectStore(DB_STORE).index('userEmail');
        const keyRange = IDBKeyRange.only(userEmail);
        const getAll = store.getAll(keyRange);

        getAll.onsuccess = () => {
          const chats = getAll.result.filter((chat) => chat.uuid === uuid).map(({ userEmail, uuid, ...chat }) => chat);
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
  saveChats = (chats: Chat[]): Promise<void> => {
    const { userEmail, uuid } = this.validateState('saveChats');

    return this.createTransaction('readwrite', (store) => {
      chats.forEach((chat) => {
        const chatEntry = {
          userEmail,
          uuid,
          ...{
            ...chat,
            messages: chat.messages.filter(
              (message) => message.contextType === 'userPrompt' || message.contextType === 'toolResult'
            ),
          },
        };
        store.put(chatEntry);
      });
    });
  };

  // Delete a list of chats
  deleteChats = (chatIds: string[]): Promise<void> => {
    const { userEmail, uuid } = this.validateState('deleteChats');

    return this.createTransaction('readwrite', (store) => {
      chatIds.forEach((chatId) => {
        store.delete([userEmail, uuid, chatId]);
      });
    });
  };

  // Used by tests to clear all entries from the indexedDb for this fileId
  testClear = (): Promise<void> => {
    return this.createTransaction('readwrite', (store) => {
      store.clear();
    });
  };
}

export const aiAnalystOfflineChats = new AIAnalystOfflineChats();
