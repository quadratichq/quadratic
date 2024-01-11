import { debugShowFileIO } from '@/debugFlags';

const DB_NAME = 'Quadratic-Offline';
const DB_VERSION = 1;
const DB_STORE = 'transactions';

class Offline {
  private db: IDBDatabase | undefined;
  private index = 0;
  constructor() {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = (event) => {
      console.error('Error opening indexedDB', event);
    };

    request.onsuccess = () => {
      this.db = request.result;
    };

    request.onupgradeneeded = () => {
      const db = request.result;
      // creates an Object store that holds operations for a given key
      const objectStore = db.createObjectStore(DB_STORE, {
        keyPath: ['fileId', 'transactionId', 'index'],
      });
      objectStore.createIndex('fileId', 'fileId', { unique: true });
      this.db = db;
    };
  }

  get fileId(): string {
    return window.location.pathname.split('/')[2];
  }

  async load(): Promise<string | undefined> {
    return new Promise((resolve, reject) => {
      const store = this.getFileIndex(true);
      const keyRange = IDBKeyRange.only(this.fileId);
      store.getAll().onsuccess = (event) => {};
      if (debugShowFileIO) {
        if (unsavedTransactions) {
          console.log(`[Offline] Loaded unsaved transactions (${Math.round(unsavedTransactions.length / 1000)}kb).`);
        } else {
          console.log('[Offline] No unsaved transactions found.');
        }
      }
      return unsavedTransactions;
    });
  }

  private getFileIndex(readOnly: boolean, index: string): IDBIndex {
    if (!this.db) throw new Error('Expected db to be initialized in addTransaction');

    const tx = this.db.transaction(DB_STORE, readOnly ? 'readonly' : 'readwrite');
    return tx.objectStore(DB_STORE).index(index);
  }

  private getObjectStore(): IDBObjectStore {
    if (!this.db) throw new Error('Expected db to be initialized in addTransaction');

    const tx = this.db.transaction(DB_STORE, readOnly ? 'readonly' : 'readwrite');
    return tx.objectStore(DB_STORE);
  }

  // Adds the transaction to the unsent transactions list.
  // This is called by Rust when a user transaction is created.
  addTransaction(transactionId: string, transaction: string) {
    const store = this.getObjectStore();
    store.add({ fileId: this.fileId, transactionId, transaction, index: this.index++ });
    if (debugShowFileIO) {
      console.log(`[Offline] Added transaction ${transactionId} to indexedDB.`);
    }
  }

  // Removes the transaction from the unsent transactions list.
  // This is called by TS when a transaction is successfully sent to the socket server.
  markTransactionSent(transactionId: string) {
    const store = this.getObjectStore();
    store.delete([this.fileId, transactionId]);
    if (debugShowFileIO) {
      console.log(`[Offline] Removed transaction ${transactionId} from indexedDB.`);
    }
  }
}

export const offline = new Offline();

// need to bind to window because rustCallbacks.ts cannot include any TS imports; see https://rustwasm.github.io/wasm-bindgen/reference/js-snippets.html#caveats
window.addTransaction = offline.addTransaction.bind(offline);
