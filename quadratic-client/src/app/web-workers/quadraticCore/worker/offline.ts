import { debugFlag } from '@/app/debugFlags/debugFlags';
import { core } from '@/app/web-workers/quadraticCore/worker/core';
import { coreClient } from '@/app/web-workers/quadraticCore/worker/coreClient';
import { sendAnalyticsError } from '@/shared/utils/error';
import { Dexie, type Table } from 'dexie';

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

// [fileId, transactionId, index]
type OfflineEntryKey = [string, string, number];

interface OfflineStats {
  transactions: number;
  operations: number;
  timestamps: number[];
}

class Offline {
  private db?: Dexie;
  private transactionsTable?: Table<OfflineEntry, OfflineEntryKey>;
  private index = 0;
  fileId?: string;

  // When true, skip all offline transaction saving (used in embed mode)
  private noMultiplayer = false;

  // The `stats.operations` are not particularly interesting right now because
  // we send the entire operations batched together; we'll need to send partial
  // messages with separate operations to get good progress information.
  stats: OfflineStats = { transactions: 0, operations: 0, timestamps: [] };

  private sendAnalyticsError = (from: string, error: Error | unknown) => {
    sendAnalyticsError('Offline', from, error);
  };

  // Creates a connection to the indexedDb database
  init = async (fileId: string, noMultiplayer = false): Promise<undefined> => {
    try {
      this.fileId = fileId;
      this.noMultiplayer = noMultiplayer;

      // Skip database initialization if noMultiplayer is enabled
      if (noMultiplayer) {
        // Set up a no-op callback for addUnsentTransaction
        self.addUnsentTransaction = () => {};
        return undefined;
      }

      this.db = new Dexie(DB_NAME);
      this.db.version(DB_VERSION).stores({
        [DB_STORE]: '[fileId+transactionId+index], fileId, transactionId',
      });

      this.transactionsTable = this.db.table(DB_STORE);

      await this.db.open();

      self.addUnsentTransaction = this.addUnsentTransaction;

      return undefined;
    } catch (error) {
      this.sendAnalyticsError('init', error);
      return undefined;
    }
  };

  // Helper method to validate required properties
  private validateState = (methodName: string) => {
    if (this.noMultiplayer) {
      return null;
    }
    if (!this.db || !this.transactionsTable || !this.fileId) {
      throw new Error(`Expected db, transactionsTable and fileId to be set in ${methodName} method.`);
    }

    return {
      db: this.db,
      transactionsTable: this.transactionsTable,
      fileId: this.fileId,
    };
  };

  // Loads the unsent transactions for this file from indexedDb
  load = async (): Promise<{ transactionId: string; transactions: string; timestamp?: number }[]> => {
    try {
      const state = this.validateState('load');
      if (!state) return [];
      const { transactionsTable, fileId } = state;

      const results = await transactionsTable.where('fileId').equals(fileId).toArray();

      const sortedResults = results
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
      this.index = sortedResults.length;
      this.stats = {
        transactions: sortedResults.length,
        operations: sortedResults.reduce((acc, r) => acc + r.operations, 0),
        timestamps: sortedResults.flatMap((r) => (r.timestamp ? [r.timestamp] : [])).sort((a, b) => a - b),
      };

      coreClient.sendOfflineTransactionStats();

      return sortedResults;
    } catch (error) {
      this.sendAnalyticsError('load', error);
      return [];
    }
  };

  // Adds the transaction to the unsent transactions list.
  addUnsentTransaction = async (transactionId: string, transaction: string, operations: number) => {
    try {
      const state = this.validateState('addUnsentTransaction');
      if (!state) return;
      const { transactionsTable, fileId } = state;

      const offlineEntry: OfflineEntry = {
        fileId,
        transactionId,
        transaction,
        operations,
        index: this.index++,
        timestamp: Date.now(),
      };

      await transactionsTable.add(offlineEntry);

      this.stats.transactions++;
      this.stats.operations += operations;

      coreClient.sendOfflineTransactionStats();

      if (debugFlag('debugOffline')) {
        console.log(`[Offline] Added transaction ${transactionId} to indexedDB.`);
      }
    } catch (error) {
      this.sendAnalyticsError('addUnsentTransaction', error);
    }
  };

  // Removes the transaction from the unsent transactions list.
  markTransactionSent = async (transactionId: string) => {
    try {
      const state = this.validateState('markTransactionSent');
      if (!state) return;
      const { transactionsTable } = state;

      const transaction = await transactionsTable.where('transactionId').equals(transactionId).toArray();
      const keys = transaction.map<OfflineEntryKey>((entry) => [entry.fileId, entry.transactionId, entry.index]);
      await transactionsTable.bulkDelete(keys);

      // Update stats
      transaction.forEach((entry) => {
        this.stats.transactions--;
        this.stats.operations -= entry.operations;
      });

      coreClient.sendOfflineTransactionStats();

      if (debugFlag('debugOffline')) {
        console.log(`[Offline] Removed transaction ${transactionId} from indexedDB.`);
      }
    } catch (error) {
      this.sendAnalyticsError('markTransactionSent', error);
    }
  };

  // Checks whether there are any unsent transactions in the indexedDb (ie, whether we have transactions sent to the server but not received back).
  unsentTransactionsCount = async (): Promise<number> => {
    try {
      const state = this.validateState('unsentTransactionsCount');
      if (!state) return 0;
      const { transactionsTable, fileId } = state;

      return await transactionsTable.where('fileId').equals(fileId).count();
    } catch (error) {
      this.sendAnalyticsError('unsentTransactionsCount', error);
      return 0;
    }
  };

  // Loads unsent transactions and applies them to the grid. This is called twice: once after the grid and pixi loads;
  // and a second time when the socket server connects.
  loadTransactions = async () => {
    try {
      const unsentTransactions = await this.load();
      if (debugFlag('debugShowOfflineTransactions')) {
        console.log(JSON.stringify(unsentTransactions));
      }

      if (debugFlag('debugOffline')) {
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
    } catch (error) {
      this.sendAnalyticsError('loadTransactions', error);
    }
  };

  // Used by tests to clear all entries from the indexedDb for this fileId
  testClear = async () => {
    const state = this.validateState('testClear');
    if (!state) return;
    const { transactionsTable } = state;

    await transactionsTable.clear();
  };
}

export const offline = new Offline();
