import { debugFlag, debugFlagWait } from '@/app/debugFlags/debugFlags';
import type {
  CoreMultiplayerMessage,
  MultiplayerCoreMessage,
} from '@/app/web-workers/multiplayerWebWorker/multiplayerCoreMessages';
import { core } from '@/app/web-workers/quadraticCore/worker/core';

declare var self: WorkerGlobalScope &
  typeof globalThis & {
    sendTransaction: (transactionId: string, operations: ArrayBufferLike) => void;
    requestTransactions: (sequenceNum: number) => void;
  };

class CoreMultiplayer {
  private coreMessagePort?: MessagePort;

  async init(coreMessagePort: MessagePort) {
    this.coreMessagePort = coreMessagePort;
    this.coreMessagePort.onmessage = this.handleMessage;

    if (await debugFlagWait('debugWebWorkers')) console.log('[coreMultiplayer] initialized');
  }

  private send(message: CoreMultiplayerMessage, transfer?: Transferable[]) {
    // In noMultiplayer mode (e.g., embed), coreMessagePort is never initialized.
    // Transactions stay local-only and don't need to be sent.
    if (!this.coreMessagePort) return;
    if (transfer) {
      this.coreMessagePort.postMessage(message, transfer);
    } else {
      this.coreMessagePort.postMessage(message);
    }
  }

  private handleMessage = async (e: MessageEvent<MultiplayerCoreMessage>) => {
    if (debugFlag('debugWebWorkersMessages')) console.log(`[coreMultiplayer] message: ${e.data.type}`);

    switch (e.data.type) {
      case 'multiplayerCoreReceiveTransaction':
        await core.receiveTransaction(e.data);
        break;

      case 'multiplayerCoreReceiveCurrentTransaction':
        core.receiveSequenceNum(e.data.sequenceNum);
        break;

      case 'multiplayerCoreReceiveTransactions':
        await core.receiveTransactions(e.data);
        break;

      case 'multiplayerCoreReceiveTransactionAck':
        await core.receiveTransactionAck(e.data.transactionId, e.data.sequenceNum);
        break;

      default:
        console.warn('[coreMultiplayer] Unhandled message type', e.data);
    }
  };

  sendTransaction = (transactionId: string, operations: ArrayBufferLike) => {
    this.send(
      {
        type: 'coreMultiplayerTransaction',
        operations,
        transaction_id: transactionId,
      },
      [operations]
    );
  };

  requestTransactions = (sequenceNum: number) => {
    this.send({
      type: 'coreMultiplayerRequestTransactions',
      sequenceNum,
    });
  };
}

export const coreMultiplayer = new CoreMultiplayer();

self.sendTransaction = coreMultiplayer.sendTransaction;
self.requestTransactions = coreMultiplayer.requestTransactions;
