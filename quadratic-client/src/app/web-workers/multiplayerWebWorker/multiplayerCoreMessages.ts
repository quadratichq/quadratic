import type { ReceiveTransaction } from '@/app/web-workers/multiplayerWebWorker/multiplayerTypes';

export interface MultiplayerCoreSequenceNum {
  type: 'multiplayerCoreSequenceNum';
  sequenceNum: number;
}

export interface CoreMultiplayerTransaction {
  type: 'coreMultiplayerTransaction';
  operations: ArrayBufferLike;
  transaction_id: string;
}

export interface MultiplayerCoreReceiveTransactions {
  type: 'multiplayerCoreReceiveTransactions';
  transactions: ReceiveTransaction[];
}

export interface MultiplayerCoreReceiveTransactionAck {
  type: 'multiplayerCoreReceiveTransactionAck';
  transactionId: string;
  sequenceNum: number;
}

export interface MultiplayerCoreReceiveTransaction {
  type: 'multiplayerCoreReceiveTransaction';
  transaction: ReceiveTransaction;
}

export interface MultiplayerCoreReceiveCurrentTransaction {
  type: 'multiplayerCoreReceiveCurrentTransaction';
  sequenceNum: number;
}

export interface CoreMultiplayerRequestTransactions {
  type: 'coreMultiplayerRequestTransactions';
  sequenceNum: number;
}

export type MultiplayerCoreMessage =
  | MultiplayerCoreSequenceNum
  | MultiplayerCoreReceiveTransactions
  | MultiplayerCoreReceiveTransaction
  | MultiplayerCoreReceiveCurrentTransaction
  | MultiplayerCoreReceiveTransactionAck;

export type CoreMultiplayerMessage = CoreMultiplayerTransaction | CoreMultiplayerRequestTransactions;
