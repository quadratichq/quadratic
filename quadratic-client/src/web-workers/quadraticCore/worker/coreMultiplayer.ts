import { debugWebWorkers } from '@/debugFlags';
import { TransactionSummary } from '@/quadratic-core/types';
import { CoreMultiplayerMessage, MultiplayerCoreMessage } from '../../multiplayerWebWorker/multiplayerCoreMessages';
import { core } from './core';

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
    switch (e.data.type) {
      case 'multiplayerCoreSequenceNum':
        core.receiveSequenceNum(e.data);
        break;

      case 'multiplayerCoreReceiveTransaction':
        core.receiveTransaction(e.data);
        break;

      default:
        console.warn('[coreMultiplayer] Unhandled message type', e.data);
    }
  };

  handleSummary(summary: TransactionSummary) {
    if (summary.operations && summary.transaction_id) {
      this.send({
        type: 'coreMultiplayerTransaction',
        operations: summary.operations,
        transaction_id: summary.transaction_id,
      });
    }
  }
}

export const coreMultiplayer = new CoreMultiplayer();
