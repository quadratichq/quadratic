import { debugWebWorkers, debugWebWorkersMessages } from '@/debugFlags';
import { CoreMultiplayerMessage, MultiplayerCoreMessage } from '../../multiplayerWebWorker/multiplayerCoreMessages';
import { core } from './core';

declare var self: WorkerGlobalScope &
  typeof globalThis & {
    sendTransaction: (transactionId: string, operations: string) => void;
  };

class CoreMultiplayer {
  private coreMessagePort?: MessagePort;

  init(coreMessagePort: MessagePort) {
    this.coreMessagePort = coreMessagePort;
    this.coreMessagePort.onmessage = this.handleMessage;

    if (debugWebWorkers) console.log('[coreMultiplayer] initialized');
  }

  private send(message: CoreMultiplayerMessage) {
    if (!this.coreMessagePort) throw new Error('Expected coreMessagePort to be defined in CoreMultiplayer');
    this.coreMessagePort.postMessage(message);
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

      default:
        console.warn('[coreMultiplayer] Unhandled message type', e.data);
    }
  };

  sendTransaction = (transactionId: string, operations: string) => {
    this.send({
      type: 'coreMultiplayerTransaction',
      operations,
      transaction_id: transactionId,
    });
  };
}

export const coreMultiplayer = new CoreMultiplayer();

self.sendTransaction = coreMultiplayer.sendTransaction;
