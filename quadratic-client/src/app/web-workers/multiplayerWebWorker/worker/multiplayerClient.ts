/**
 * Communication between multiplayer web worker and the main thread
 */

import { debugFlag } from '@/app/debugFlags/debugFlags';
import type {
  ClientMultiplayerMessage,
  MultiplayerClientMessage,
  MultiplayerState,
} from '@/app/web-workers/multiplayerWebWorker/multiplayerClientMessages';
import type { MessageUserUpdate, ReceiveRoom } from '@/app/web-workers/multiplayerWebWorker/multiplayerTypes';
import { multiplayerCore } from '@/app/web-workers/multiplayerWebWorker/worker/multiplayerCore';
import { cellEditDefault, multiplayerServer } from '@/app/web-workers/multiplayerWebWorker/worker/multiplayerServer';

declare var self: WorkerGlobalScope & typeof globalThis;

class MultiplayerClient {
  // messages pending a reconnect
  private waitingForConnection: Record<number, Function> = {};
  private id = 0;

  constructor() {
    self.onmessage = this.handleMessage;
  }

  private send(message: MultiplayerClientMessage) {
    self.postMessage(message);
  }

  private handleMessage = async (e: MessageEvent<ClientMultiplayerMessage>) => {
    if (
      debugFlag('debugWebWorkersMessages') &&
      !['clientMultiplayerMouseMove', 'clientMultiplayerViewport'].includes(e.data.type)
    )
      console.log(`[multiplayerClient] message: ${e.data.type}`);

    switch (e.data.type) {
      case 'clientMultiplayerInit':
        multiplayerServer.init(e.data);
        multiplayerCore.init(e.ports[0]);
        break;

      case 'clientMultiplayerOnline':
        multiplayerServer.online();
        break;

      case 'clientMultiplayerOffline':
        multiplayerServer.offline();
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

      case 'clientMultiplayerFollow':
        multiplayerServer.userUpdate.follow = e.data.follow;
        break;

      case 'clientMultiplayerRefreshJwt':
        if (e.data.id in this.waitingForConnection) {
          this.waitingForConnection[e.data.id]();
          delete this.waitingForConnection[e.data.id];
        } else {
          throw new Error('Expected id to be in waitingForConnection for clientMultiplayerRefreshJwt');
        }
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

  sendState(data: MultiplayerState) {
    this.send({
      type: 'multiplayerClientState',
      state: data,
    });
  }

  reload() {
    this.send({
      type: 'multiplayerClientReload',
    });
  }

  sendRefreshJwt(): Promise<void> {
    return new Promise((resolve) => {
      const id = this.id++;
      this.waitingForConnection[id] = resolve;
      this.send({
        type: 'multiplayerClientRefreshJwt',
        id,
      });
    });
  }
}

export const multiplayerClient = new MultiplayerClient();
