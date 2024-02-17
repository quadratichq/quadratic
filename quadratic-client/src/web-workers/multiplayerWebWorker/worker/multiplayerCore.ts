/**
 * Communication between multiplayer web worker and the quadraticCore web worker
 */

import { CoreMultiplayerMessage, MultiplayerCoreMessage } from '../multiplayerCoreMessages';

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
    switch (e.data.type) {
      case 'multiplayerCoreEnterRoom':
        break;

      default:
        console.warn('[multiplayerCore] Unhandled message type', e.data);
    }
  }

  sendSequenceNum(sequenceNum: number) {
    this.send({
      type: 'multiplayerCoreSequenceNum',
      sequenceNum,
    });
  }
}

export const multiplayerCore = new MultiplayerCore();
