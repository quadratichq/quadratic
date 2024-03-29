import { debugShowFileIO } from '@/debugFlags';

const DB_NAME = 'Quadratic-Offline';
const DB_VERSION = 1;
const DB_STORE = 'transactions';

declare var self: WorkerGlobalScope &
  typeof globalThis & {
    addUnsentTransaction: (transactionId: string, operations: string) => void;
  };

class Offline {
  private db: IDBDatabase | undefined;
  private index = 0;
  fileId?: string;

  // Creates a connection to the indexedDb database
  init(fileId: string): Promise<undefined> {
    return new Promise((resolve) => {
      this.fileId = fileId;
      const request = self.indexedDB.open(DB_NAME, DB_VERSION);
      request.onerror = (event) => {
        console.error('Error opening indexedDB', event);
      };

      request.onsuccess = () => {
        this.db = request.result;
        self.addUnsentTransaction = offline.addUnsentTransaction.bind(offline);
        resolve(undefined);
      };

      request.onupgradeneeded = () => {
        const db = request.result;
        // creates an Object store that holds operations for a given key
        const objectStore = db.createObjectStore(DB_STORE, {
          keyPath: ['fileId', 'transactionId', 'index'],
        });
        objectStore.createIndex('fileId', 'fileId');
        objectStore.createIndex('transactionId', 'transactionId');
      };
    });
  }

  // gets a file index from the indexedDb
  private getFileIndex(readOnly: boolean, index: string): IDBIndex {
    if (!this.db) throw new Error('Expected db to be initialized in getFileIndex');
    const tx = this.db.transaction(DB_STORE, readOnly ? 'readonly' : 'readwrite');
    return tx.objectStore(DB_STORE).index(index);
  }

  // gets an object store from the indexedDb
  private getObjectStore(readOnly: boolean): IDBObjectStore {
    if (!this.db) throw new Error('Expected db to be initialized in getObjectStore');
    const tx = this.db.transaction(DB_STORE, readOnly ? 'readonly' : 'readwrite');
    return tx.objectStore(DB_STORE);
  }

  // Loads the unsent transactions for this file from indexedDb
  async load(): Promise<{ transactionId: string; operations: string }[] | undefined> {
    return new Promise((resolve, reject) => {
      if (!this.fileId) throw new Error("Expected fileId to be set in 'load' method.");
      const store = this.getFileIndex(true, 'fileId');
      const keyRange = IDBKeyRange.only(this.fileId);
      const getAll = store.getAll(keyRange);
      getAll.onsuccess = () => {
        const results = getAll.result
          .sort((a, b) => a.index - b.index)
          .map((r) => ({ transactionId: r.transactionId, operations: r.transaction }));
        resolve(results);
      };
    });
  }

  // Adds the transaction to the unsent transactions list.
  addUnsentTransaction(transactionId: string, transaction: string) {
    const store = this.getObjectStore(false);
    if (!this.fileId) throw new Error("Expected fileId to be set in 'addUnsentTransaction' method.");
    store.add({ fileId: this.fileId, transactionId, transaction, index: this.index++ });
    if (debugShowFileIO) {
      console.log(`[Offline] Added transaction ${transactionId} to indexedDB.`);
    }
  }

  // Removes the transaction from the unsent transactions list.
  markTransactionSent(transactionId: string) {
    const index = this.getFileIndex(false, 'transactionId');
    index.openCursor(IDBKeyRange.only(transactionId)).onsuccess = (event) => {
      const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
      if (cursor) {
        cursor.delete();
        if (debugShowFileIO) {
          console.log(`[Offline] Removed transaction ${transactionId} from indexedDB.`);
        }
      } else {
        if (debugShowFileIO) {
          console.log(`[Offline] Failed to remove transaction ${transactionId} from indexedDB (might not exist).`);
        }
      }
    };
  }

  // Checks whether there are any unsent transactions in the indexedDb (ie, whether we have transactions sent to the server but not received back).
  async unsentTransactionsCount(): Promise<number> {
    return new Promise((resolve) => {
      const store = this.getFileIndex(true, 'fileId');
      const keyRange = IDBKeyRange.only(this.fileId);
      const request = store.getAllKeys(keyRange);
      request.onsuccess = () => {
        resolve(request.result.length);
      };
      request.onerror = () => {
        resolve(0);
      };
    });
  }

  // Loads unsent transactions and applies them to the grid. This is called twice: once after the grid and pixi loads;
  // and a second time when the socket server connects.
  async loadTransactions() {
    const unsentTransactions = await this.load();
    if (debugShowFileIO) {
      if (unsentTransactions?.length) {
        console.log('[Offline] Loading unsent transactions from indexedDB.');
      } else {
        console.log('[Offline] No unsent transactions in indexedDB.');
      }
    }

    unsentTransactions?.forEach((tx) => {
      console.log(tx);
      // todo...
      // grid.applyOfflineUnsavedTransaction(tx.transactionId, tx.operations);
    });
  }

  // Used by tests to clear all entries from the indexedDb for this fileId
  testClear() {
    const store = this.getObjectStore(false);
    store.clear();
  }
}

export const offline = new Offline();
