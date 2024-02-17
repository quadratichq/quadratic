/**
 * Communication between multiplayer web worker and the quadraticCore web worker
 */

import { CoreMultiplayerMessage, MultiplayerCoreMessage } from '../multiplayerCoreMessages';
import { ReceiveEnterRoom } from '../multiplayerTypes';

declare var self: WorkerGlobalScope & typeof globalThis;

class MultiplayerCore {
  private send(message: MultiplayerCoreMessage) {
    self.postMessage(message);
  }

  private handleMessage(e: MessageEvent<CoreMultiplayerMessage>) {
    switch (e.data.type) {
      default:
        console.warn('[multiplayerCore] Unhandled message type', e.data);
    }
  }

  sendEnterRoom(enterRoom: ReceiveEnterRoom) {
    this.send({
      type: 'multiplayerClientEnterRoom',
      enterRoom,
    });
  }
}

export const multiplayerCore = new MultiplayerCore();
