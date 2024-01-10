import { debugShowFileIO } from '@/debugFlags';
import localforage from 'localforage';

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
    const unsavedTransactions = (await localforage.getItem(this.fileId)) as string;
    if (debugShowFileIO) {
      if (unsavedTransactions) {
        console.log(`[Offline] Loaded unsaved transactions (${Math.round(unsavedTransactions.length / 1000)}kb).`);
      } else {
        console.log('[Offline] No unsaved transactions found.');
      }
    }
    return unsavedTransactions;
  }

  private getObjectStore(readOnly: boolean): IDBObjectStore {
    if (!this.db) throw new Error('Expected db to be initialized in addTransaction');

    const tx = this.db.transaction(DB_STORE, readOnly ? 'readonly' : 'readwrite');
    return tx.objectStore(DB_STORE);
  }

  // Adds the transaction to the unsent transactions list.
  // This is called by Rust when a user transaction is created.
  addTransaction(transactionId: string, transaction: string) {
    const store = this.getObjectStore(false);
    store.add({ fileId: this.fileId, transactionId, transaction, index: this.index++ });
    if (debugShowFileIO) {
      console.log(`[Offline] Added transaction ${transactionId} to indexedDB.`);
    }
  }

  // Removes the transaction from the unsent transactions list.
  // This is called by TS when a transaction is successfully sent to the socket server.
  markTransactionSent(transactionId: string) {
    if (!this.db) throw new Error('Expected db to be initialized in markComplete');
    const transaction = this.db.transaction([DB_STORE], 'readwrite');
    const objectStore = transaction.objectStore(DB_STORE);
    objectStore.delete([this.fileId, transactionId]);
    if (debugShowFileIO) {
      console.log(`[Offline] Removed transaction ${transactionId} from indexedDB.`);
    }
  }
}

export const offline = new Offline();

// need to bind to window because rustCallbacks.ts cannot include any TS imports; see https://rustwasm.github.io/wasm-bindgen/reference/js-snippets.html#caveats
window.addTransaction = offline.addTransaction.bind(offline);
