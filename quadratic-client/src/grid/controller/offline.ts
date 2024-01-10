import { debugShowFileIO } from '@/debugFlags';
import localforage from 'localforage';

const DB_NAME = 'quadratic-offline';
const DB_VERSION = 1;

class Offline {
  private db: IDBDatabase | undefined;

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
      const objectStore = db.createObjectStore('transactions', {
        keyPath: ['fileId', 'transactionId'],
        autoIncrement: true,
      });
      objectStore.createIndex('fileId', 'fileId', { unique: true });
    };
  }

  get fileId(): string {
    return window.location.pathname.split('/')[2];
  }

  async load(): Promise<string | undefined> {
    const unsavedTransactions = (await localforage.getItem(this.fileId)) as string;
    if (debugShowFileIO && unsavedTransactions) {
      console.log(`[Offline] Loaded unsaved transactions (${Math.round(unsavedTransactions.length / 1000)}kb).`);
    }
    return unsavedTransactions;
  }

  // Adds the transaction to the unsent transactions list.
  // This is called by Rust when a user transaction is created.
  addTransaction(transactionId: string, data: string) {
    if (!this.db) throw new Error('Expected db to be initialized in addTransaction');
    const transaction = this.db.transaction(['transactions'], 'readwrite');
    const objectStore = transaction.objectStore('transactions');
    objectStore.add({ fileId: this.fileId, transactionId, operations: data });
    if (debugShowFileIO) {
      console.log(`[Offline] Added transaction ${transactionId} to indexedDB.`);
    }
  }

  // Removes the transaction from the unsent transactions list.
  // This is called by TS when a transaction is successfully sent to the socket server.
  markTransactionSent(transactionId: string) {
    if (!this.db) throw new Error('Expected db to be initialized in markComplete');
    const transaction = this.db.transaction(['transactions'], 'readwrite');
    const objectStore = transaction.objectStore('transactions');
    objectStore.delete([this.fileId, transactionId]);
    if (debugShowFileIO) {
      console.log(`[Offline] Removed transaction ${transactionId} from indexedDB.`);
    }
  }
}

export const offline = new Offline();

// need to bind to window because rustCallbacks.ts cannot include any TS imports; see https://rustwasm.github.io/wasm-bindgen/reference/js-snippets.html#caveats
window.addTransaction = offline.addTransaction.bind(offline);
