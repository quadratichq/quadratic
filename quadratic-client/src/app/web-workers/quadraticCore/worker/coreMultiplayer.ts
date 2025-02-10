import { debugWebWorkers, debugWebWorkersMessages } from '@/app/debugFlags';
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

  init(coreMessagePort: MessagePort) {
    this.coreMessagePort = coreMessagePort;
    this.coreMessagePort.onmessage = this.handleMessage;

    if (debugWebWorkers) console.log('[coreMultiplayer] initialized');
  }

  private send(message: CoreMultiplayerMessage, transfer?: Transferable[]) {
    if (!this.coreMessagePort) throw new Error('Expected coreMessagePort to be defined in CoreMultiplayer');
    if (transfer) {
      this.coreMessagePort.postMessage(message, transfer);
    } else {
      this.coreMessagePort.postMessage(message);
    }
  }

  private handleMessage = (e: MessageEvent<MultiplayerCoreMessage>) => {
    if (debugWebWorkersMessages) console.log(`[coreMultiplayer] message: ${e.data.type}`);

    switch (e.data.type) {
      case 'multiplayerCoreReceiveTransaction':
        core.receiveTransaction(e.data);
        break;

      case 'multiplayerCoreReceiveCurrentTransaction':
        core.receiveSequenceNum(e.data.sequenceNum);
        break;

      case 'multiplayerCoreReceiveTransactions':
        core.receiveTransactions(e.data);
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
