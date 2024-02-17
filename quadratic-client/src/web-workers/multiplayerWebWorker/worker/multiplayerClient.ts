/**
 * Communication between multiplayer web worker and the main thread
 */

import { ClientMultiplayerMessage, MultiplayerClientMessage } from '../multiplayerClientMessages';
import { MessageUserUpdate, ReceiveRoom } from '../multiplayerTypes';
import { multiplayerServer } from './multiplayerServer';

declare var self: WorkerGlobalScope & typeof globalThis;

class MultiplayerClient {
  constructor() {
    self.onmessage = this.handleMessage;
  }

  private send(message: MultiplayerClientMessage) {
    self.postMessage(message);
  }

  private handleMessage = async (e: MessageEvent<ClientMultiplayerMessage>) => {
    switch (e.data.type) {
      case 'clientMultiplayerInit':
        multiplayerServer.init(e.data);
        break;

      case 'clientMultiplayerMouseMove':
        // multiplayerServer.sendMouseMove(e.data);
        break;

      default:
        console.warn('[multiplayerClient] Unhandled message type', e.data);
    }
  };

  sendUsersInRoom(room: ReceiveRoom) {
    this.send({
      type: 'multiplayerClientUsersInRoom',
      room,
    });
  }

  sendUserUpdate(data: MessageUserUpdate) {
    this.send({
      type: 'multiplayerClientUserUpdate',
      userUpdate: data.update,
      sessionId: data.session_id,
      fileId: data.file_id,
    });
  }
}

export const multiplayerClient = new MultiplayerClient();
