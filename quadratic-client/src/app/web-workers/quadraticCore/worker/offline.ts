import { debugOffline, debugShowOfflineTransactions } from '@/app/debugFlags';
import { core } from './core';
import { coreClient } from './coreClient';

const DB_NAME = 'Quadratic-Offline';
const DB_VERSION = 1;
const DB_STORE = 'transactions';

declare var self: WorkerGlobalScope &
  typeof globalThis & {
    addUnsentTransaction: (transactionId: string, transaction: string, operations: number) => void;
  };

interface OfflineEntry {
  fileId: string;
  transactionId: string;
  transaction: string;
  operations: number;
  index: number;
  timestamp: number;
}

interface OfflineStats {
  transactions: number;
  operations: number;
  timestamps: number[];
}

class Offline {
  private db: IDBDatabase | undefined;
  private index = 0;
  fileId?: string;

  // The `stats.operations` are not particularly interesting right now because
  // we send the entire operations batched together; we'll need to send partial
  // messages with separate operations to get good progress information.
  stats: OfflineStats = { transactions: 0, operations: 0, timestamps: [] };

  // Creates a connection to the indexedDb database
  init = (fileId: string): Promise<undefined> => {
    return new Promise((resolve) => {
      this.fileId = fileId;
      const request = self.indexedDB.open(DB_NAME, DB_VERSION);
      request.onerror = (event) => {
        console.error('Error opening indexedDB', event);
      };

      request.onsuccess = () => {
        this.db = request.result;
        self.addUnsentTransaction = this.addUnsentTransaction;
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
  };

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
  async load(): Promise<{ transactionId: string; transactions: string; timestamp?: number }[] | undefined> {
    if (!this.fileId) return undefined;
    return new Promise((resolve) => {
      const store = this.getFileIndex(true, 'fileId');
      const keyRange = IDBKeyRange.only(this.fileId);
      const getAll = store.getAll(keyRange);
      getAll.onsuccess = () => {
        const results = getAll.result
          .sort((a, b) => a.index - b.index)
          .map((r) => {
            return {
              transactionId: r.transactionId,
              transactions: r.transaction,
              operations: r.operations ?? 0,
              timestamp: r.timestamp,
            };
          });
        // set the index to the length of the results so that we can add new transactions to the end
        this.index = results.length;
        this.stats = {
          transactions: results.length,
          operations: results.reduce((acc, r) => acc + r.operations, 0),
          timestamps: results.flatMap((r) => (r.timestamp ? [r.timestamp] : [])).sort((a, b) => a - b),
        };
        coreClient.sendOfflineTransactionStats();
        resolve(results);
      };
    });
  }

  // Adds the transaction to the unsent transactions list.
  addUnsentTransaction = (transactionId: string, transaction: string, operations: number) => {
    const store = this.getObjectStore(false);
    if (!this.fileId) throw new Error("Expected fileId to be set in 'addUnsentTransaction' method.");
    const offlineEntry: OfflineEntry = {
      fileId: this.fileId,
      transactionId,
      transaction,
      operations,
      index: this.index++,
      timestamp: Date.now(),
    };
    store.add(offlineEntry);
    this.stats.transactions++;
    this.stats.operations += operations;
    coreClient.sendOfflineTransactionStats();
    if (debugOffline) {
      console.log(`[Offline] Added transaction ${transactionId} to indexedDB.`);
    }
  };

  // Removes the transaction from the unsent transactions list.
  markTransactionSent(transactionId: string) {
    const index = this.getFileIndex(false, 'transactionId');
    index.openCursor(IDBKeyRange.only(transactionId)).onsuccess = (event) => {
      const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
      if (cursor) {
        this.stats.transactions--;
        this.stats.operations -= cursor.value.operations;
        coreClient.sendOfflineTransactionStats();
        cursor.delete();
        if (debugOffline) {
          console.log(`[Offline] Removed transaction ${transactionId} from indexedDB.`);
        }
      } else {
        if (debugOffline) {
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
    if (debugShowOfflineTransactions) {
      console.log(JSON.stringify(unsentTransactions));
    }
    if (debugOffline) {
      if (unsentTransactions?.length) {
        console.log(`[Offline] Loading ${unsentTransactions.length} unsent transactions from indexedDB.`);
      } else {
        console.log('[Offline] No unsent transactions in indexedDB.');
      }
    }

    if (unsentTransactions?.length) {
      unsentTransactions.forEach((tx) => {
        // we remove the transaction is there was a problem applying it (eg, if
        // the schema has changed since it was saved offline)
        if (!core.applyOfflineUnsavedTransaction(tx.transactionId, tx.transactions)) {
          this.markTransactionSent(tx.transactionId);
        }
      });
    }

    coreClient.sendOfflineTransactionsApplied(this.stats.timestamps);
  }

  // Used by tests to clear all entries from the indexedDb for this fileId
  testClear() {
    const store = this.getObjectStore(false);
    store.clear();
  }
}

export const offline = new Offline();
