import indexedDB from 'fake-indexeddb/auto';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { offline } from './offline';

globalThis.window.indexedDB = indexedDB;

describe('offline', () => {
  beforeAll(() => {
    window.location.pathname = '/file/123';
  });

  beforeEach(() => {
    offline.testClear();
  });

  it('properly defines fileId', () => {
    expect(offline).toBeDefined();
    expect(offline.fileId).toBe('123');
  });

  it('loads empty offline', async () => {
    expect(await offline.load()).toStrictEqual([]);
  });

  it('populates and loads offline', async () => {
    offline.addUnsentTransaction('1', 'a');
    offline.addUnsentTransaction('2', 'b');
    offline.addUnsentTransaction('3', 'c');
    const load = await offline.load();
    expect(load?.length).toBe(3);
    expect(load).toStrictEqual([
      { transactionId: '1', operations: 'a' },
      { transactionId: '2', operations: 'b' },
      { transactionId: '3', operations: 'c' },
    ]);
  });

  it('marks offline transactions as complete', async () => {
    offline.addUnsentTransaction('1', 'a');
    offline.addUnsentTransaction('2', 'b');
    offline.addUnsentTransaction('3', 'c');
    offline.markTransactionSent('2');

    const load = await offline.load();
    expect(load?.length).toBe(2);
    expect(await offline.load()).toStrictEqual([
      { transactionId: '1', operations: 'a' },
      { transactionId: '3', operations: 'c' },
    ]);
  });

  it('checks whether there are any unsent transactions in db', async () => {
    expect(await offline.unsentTransactionsCount()).toBe(0);
    offline.addUnsentTransaction('1', 'a');
    offline.addUnsentTransaction('2', 'b');
    offline.addUnsentTransaction('3', 'c');
    expect(await offline.unsentTransactionsCount()).toBe(3);
    offline.markTransactionSent('2');
    expect(await offline.unsentTransactionsCount()).toBe(2);
  });

  // it('loads all transactions on initialization', async () => {
  //   console.log('here...');
  //   hello();
  //   grid.test();

  //   offline.addUnsentTransaction('1', 'a');
  //   offline.addUnsentTransaction('2', 'b');
  //   offline.addUnsentTransaction('3', 'c');
  //   offline.markTransactionSent('2');

  //   await offline.loadTransactions();
  // });
});
