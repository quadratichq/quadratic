import 'fake-indexeddb/auto';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { offline } from './offline';

declare var self: WorkerGlobalScope &
  typeof globalThis & {
    indexedDB: any;
  };

describe('offline', () => {
  beforeAll(async () => {
    self.indexedDB = indexedDB;
    await offline.init('123');
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
    offline.addUnsentTransaction('1', 'a', 1);
    offline.addUnsentTransaction('2', 'b', 1);
    offline.addUnsentTransaction('3', 'c', 1);
    const load = await offline.load();
    expect(load?.length).toBe(3);
    expect(load![0].transactionId).toBe('1');
    expect(load![0].transactions).toBe('a');
    expect(load![1].transactionId).toBe('2');
    expect(load![1].transactions).toBe('b');
    expect(load![2].transactionId).toBe('3');
    expect(load![2].transactions).toBe('c');
  });

  it('marks offline transactions as complete', async () => {
    offline.addUnsentTransaction('1', 'a', 1);
    offline.addUnsentTransaction('2', 'b', 1);
    offline.addUnsentTransaction('3', 'c', 1);
    offline.markTransactionSent('2');

    const load = await offline.load();
    expect(load?.length).toBe(2);
    expect(load![0].transactionId).toBe('1');
    expect(load![0].transactions).toBe('a');
    expect(load![1].transactionId).toBe('3');
    expect(load![1].transactions).toBe('c');
  });

  it('checks whether there are any unsent transactions in db', async () => {
    expect(await offline.unsentTransactionsCount()).toBe(0);
    offline.addUnsentTransaction('1', 'a', 1);
    offline.addUnsentTransaction('2', 'b', 1);
    offline.addUnsentTransaction('3', 'c', 1);
    expect(await offline.unsentTransactionsCount()).toBe(3);
    offline.markTransactionSent('2');
    expect(await offline.unsentTransactionsCount()).toBe(2);
  });
});
