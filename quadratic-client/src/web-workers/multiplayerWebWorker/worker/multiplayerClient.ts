/**
 * Communication between multiplayer web worker and the main thread
 */

import { debugWebWorkersMessages } from '@/debugFlags';
import { ClientMultiplayerMessage, MultiplayerClientMessage, MultiplayerState } from '../multiplayerClientMessages';
import { MessageUserUpdate, ReceiveRoom } from '../multiplayerTypes';
import { multiplayerCore } from './multiplayerCore';
import { cellEditDefault, multiplayerServer } from './multiplayerServer';

declare var self: WorkerGlobalScope & typeof globalThis;

class MultiplayerClient {
  constructor() {
    self.onmessage = this.handleMessage;
  }

  private send(message: MultiplayerClientMessage) {
    self.postMessage(message);
  }

  private handleMessage = async (e: MessageEvent<ClientMultiplayerMessage>) => {
    if (debugWebWorkersMessages && !['clientMultiplayerMouseMove', 'clientMultiplayerViewport'].includes(e.data.type))
      console.log(`[multiplayerClient] message: ${e.data.type}`);

    switch (e.data.type) {
      case 'clientMultiplayerInit':
        multiplayerServer.init(e.data);
        multiplayerCore.init(e.ports[0]);
        break;

      case 'clientMultiplayerMouseMove':
        multiplayerServer.userUpdate.x = e.data.x;
        multiplayerServer.userUpdate.y = e.data.y;
        multiplayerServer.userUpdate.visible = e.data.visible;
        break;

      case 'clientMultiplayerCellEdit':
        multiplayerServer.userUpdate.cell_edit = e.data.cellEdit ?? cellEditDefault();
        break;

      case 'clientMultiplayerSheet':
        multiplayerServer.userUpdate.sheet_id = e.data.sheetId;
        break;

      case 'clientMultiplayerViewport':
        multiplayerServer.userUpdate.viewport = e.data.viewport;
        break;

      case 'clientMultiplayerCodeRunning':
        multiplayerServer.userUpdate.code_running = e.data.sheetPos;
        break;

      case 'clientMultiplayerSelection':
        multiplayerServer.userUpdate.selection = e.data.selection;
        break;

      default:
        console.warn('[multiplayerClient] Unhandled message type', e.data);
    }
  };

  sendUsersInRoom(room: ReceiveRoom, refresh: 'recommended' | 'required' | undefined) {
    this.send({
      type: 'multiplayerClientUsersInRoom',
      room,
      refresh,
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

  sendState(data: MultiplayerState) {
    this.send({
      type: 'multiplayerClientState',
      state: data,
    });
  }
}

export const multiplayerClient = new MultiplayerClient();
