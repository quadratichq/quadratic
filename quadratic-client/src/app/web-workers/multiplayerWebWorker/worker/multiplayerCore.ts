/**
 * Communication between multiplayer web worker and the quadraticCore web worker
 */

import { debugFlag } from '@/app/debugFlags/debugFlags';
import type {
  CoreMultiplayerMessage,
  MultiplayerCoreMessage,
} from '@/app/web-workers/multiplayerWebWorker/multiplayerCoreMessages';
import type { ReceiveTransaction, ReceiveTransactions } from '@/app/web-workers/multiplayerWebWorker/multiplayerTypes';
import { multiplayerServer } from '@/app/web-workers/multiplayerWebWorker/worker/multiplayerServer';

class MultiplayerCore {
  private coreMessagePort?: MessagePort;

  init(coreMessagePort: MessagePort) {
    this.coreMessagePort = coreMessagePort;
    this.coreMessagePort.onmessage = this.handleMessage;
  }

  private send(message: MultiplayerCoreMessage) {
    if (!this.coreMessagePort) throw new Error('Expected coreMessagePort to be defined in MultiplayerCore');
    this.coreMessagePort.postMessage(message);
  }

  private handleMessage(e: MessageEvent<CoreMultiplayerMessage>) {
    if (debugFlag('debugWebWorkersMessages')) console.log(`[multiplayerCore] message: ${e.data.type}`);

    switch (e.data.type) {
      case 'coreMultiplayerTransaction':
        multiplayerServer.sendTransaction(e.data);
        break;

      case 'coreMultiplayerRequestTransactions':
        multiplayerServer.requestTransactions(e.data.sequenceNum);
        break;

      default:
        console.warn('[multiplayerCore] Unhandled message type', e.data);
    }
  }

  receiveTransaction(transaction: ReceiveTransaction) {
    this.send({
      type: 'multiplayerCoreReceiveTransaction',
      transaction,
    });
  }

  receiveCurrentTransaction(sequenceNum: number) {
    this.send({
      type: 'multiplayerCoreReceiveCurrentTransaction',
      sequenceNum,
    });
  }

  receiveTransactions(receive_transactions: ReceiveTransactions) {
    this.send({
      type: 'multiplayerCoreReceiveTransactions',
      transactions: receive_transactions.transactions,
    });
  }

  receiveTransactionAck(transactionId: string, sequenceNum: number) {
    this.send({
      type: 'multiplayerCoreReceiveTransactionAck',
      transactionId,
      sequenceNum,
    });
  }
}

export const multiplayerCore = new MultiplayerCore();
