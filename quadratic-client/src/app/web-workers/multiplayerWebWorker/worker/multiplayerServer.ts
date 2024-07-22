/**
 * Communication between the multiplayer web worker and the quadratic-multiplayer server
 */

import { User } from '@auth0/auth0-spa-js';
import * as Sentry from '@sentry/react';
import sharedConstants from '../../../../../../updateAlertVersion.json';
import { debugShow, debugShowMultiplayer } from '../../../debugFlags';
import { ClientMultiplayerInit, MultiplayerState } from '../multiplayerClientMessages';
import { CoreMultiplayerTransaction } from '../multiplayerCoreMessages';
import {
  CellEdit,
  Heartbeat,
  MessageUserUpdate,
  MultiplayerServerMessage,
  ReceiveMessages,
  ReceiveRoom,
  SendEnterRoom,
  SendGetTransactions,
  SendTransaction,
  UserUpdate,
  Version,
} from '../multiplayerTypes';
import { multiplayerClient } from './multiplayerClient';
import { multiplayerCore } from './multiplayerCore';

const UPDATE_TIME_MS = 1000 / 60;
const HEARTBEAT_TIME = 1000 * 10;
const RECONNECT_AFTER_ERROR_TIMEOUT = 1000 * 5;

interface UserData {
  sheetId: string;
  selection: string;
  cellEdit: CellEdit;
  viewport: string;
  codeRunning: string;
  follow?: string;
  x?: number;
  y?: number;
}

declare var self: WorkerGlobalScope & typeof globalThis;

export const cellEditDefault = (): CellEdit => ({
  text: '',
  cursor: 0,
  active: false,
  code_editor: false,
  inline_code_editor: false,
});

export class MultiplayerServer {
  private websocket?: WebSocket;

  private _state: MultiplayerState = 'startup';
  private sessionId?: string;
  private fileId?: string;
  private user?: User;

  private connectionTimeout: number | undefined;

  private userData?: UserData;

  // messages pending a reconnect
  private waitingForConnection: { (value: unknown): void }[] = [];

  private updateAlertVersion: Version = sharedConstants;

  // queue of items waiting to be sent to the server on the next tick
  userUpdate: UserUpdate = {};

  private lastHeartbeat = 0;
  private updateId?: number;

  init(message: ClientMultiplayerInit) {
    this.sessionId = message.sessionId;
    this.fileId = message.fileId;
    this.user = message.user;

    this.userData = {
      sheetId: message.sheetId,
      selection: message.selection,
      cellEdit: message.cellEdit,
      viewport: message.viewport,
      codeRunning: message.codeRunning,
      follow: message.follow,
      x: message.x,
      y: message.y,
    };
    this.connect(true);

    self.addEventListener('online', () => {
      if (this.state === 'no internet') {
        this.state = 'not connected';
      }
    });
    self.addEventListener('offline', () => {
      this.state = 'no internet';
      this.websocket?.close();
    });
  }

  get state() {
    return this._state;
  }
  private set state(state: MultiplayerState) {
    this._state = state;
    multiplayerClient.sendState(state);
  }

  // Attempt to connect to the server.
  // @param skipFetchJwt If true, don't fetch a new JWT from the client
  // (only true on first connection, since client already provided the jwt)
  private async connect(skipFetchJwt = false) {
    if (this.state === 'connecting' || this.state === 'waiting to reconnect') {
      return;
    }

    this.state = 'connecting';
    if (!skipFetchJwt) {
      await multiplayerClient.sendRefreshJwt();
    }

    this.websocket = new WebSocket(import.meta.env.VITE_QUADRATIC_MULTIPLAYER_URL);
    this.websocket.addEventListener('message', this.handleMessage);

    this.websocket.addEventListener('close', () => {
      if (debugShowMultiplayer) console.log('[Multiplayer] websocket closed unexpectedly.');
      this.state = 'waiting to reconnect';
      this.reconnect();
    });
    this.websocket.addEventListener('error', (e) => {
      if (debugShowMultiplayer) console.log('[Multiplayer] websocket error', e);
      this.state = 'waiting to reconnect';
      this.reconnect();
    });
    this.websocket.addEventListener('open', () => {
      if (debugShow) console.log('[Multiplayer] websocket connected.');
      this.state = 'connected';
      this.enterFileRoom();
      this.waitingForConnection.forEach((resolve) => resolve(0));
      this.waitingForConnection = [];
      this.lastHeartbeat = Date.now();
      if (!this.updateId) {
        this.updateId = self.setInterval(this.update, UPDATE_TIME_MS);
      }
    });
  }

  // multiplayer for a file
  private async enterFileRoom() {
    if (!this.websocket) throw new Error('Expected websocket to be defined in enterFileRoom');
    if (!this.fileId) throw new Error('Expected fileId to be defined in enterFileRoom');
    if (!this.sessionId) throw new Error('Expected sessionId to be defined in enterFileRoom');
    if (!this.userData) throw new Error('Expected userData to be defined in enterFileRoom');

    const user = this.user;
    if (!user?.sub) throw new Error('Expected user to be defined in enterFileRoom');
    // ensure the user doesn't join a room twice
    const enterRoom: SendEnterRoom = {
      type: 'EnterRoom',
      session_id: this.sessionId,
      user_id: user.sub,
      file_id: this.fileId,
      sheet_id: this.userData.sheetId,
      selection: this.userData.selection,
      first_name: user.given_name ?? '',
      last_name: user.family_name ?? '',
      email: user.email ?? '',
      image: user.picture ?? '',
      cell_edit: this.userData.cellEdit,
      x: this.userData.x,
      y: this.userData.y,
      visible: this.userData.x !== undefined,
      viewport: this.userData.viewport,
      code_running: this.userData.codeRunning,
      follow: this.userData.follow,
    };
    this.send(enterRoom);
    if (debugShowMultiplayer) console.log(`[Multiplayer] Joined room ${this.fileId}.`);
  }

  private reconnect = () => {
    if (this.state === 'no internet' || this.connectionTimeout) return;
    console.log(`[Multiplayer] websocket closed. Reconnecting in ${RECONNECT_AFTER_ERROR_TIMEOUT / 1000}s...`);
    this.state = 'waiting to reconnect';
    this.connectionTimeout = self.setTimeout(async () => {
      this.state = 'not connected';
      this.connectionTimeout = undefined;
      this.connect();
    }, RECONNECT_AFTER_ERROR_TIMEOUT);
  };

  private update = () => {
    if (!navigator.onLine || this.state !== 'connected') return;
    if (!this.userUpdate) throw new Error('Expected userUpdate to be undefined in update');
    if (!this.websocket) throw new Error('Expected websocket to be defined in update');
    if (!this.sessionId) throw new Error('Expected sessionId to be defined in update');
    if (!this.fileId) throw new Error('Expected fileId to be defined in update');

    const now = performance.now();
    if (Object.keys(this.userUpdate).length > 0) {
      const message: MessageUserUpdate = {
        type: 'UserUpdate',
        session_id: this.sessionId,
        file_id: this.fileId,
        update: this.userUpdate,
      };
      this.websocket!.send(JSON.stringify(message));
      this.userUpdate = {};
      this.lastHeartbeat = now;
    }
    if (now - this.lastHeartbeat > HEARTBEAT_TIME) {
      if (debugShowMultiplayer) {
        console.log('[Multiplayer] Sending heartbeat to the server...');
      }
      const heartbeat: Heartbeat = {
        type: 'Heartbeat',
        session_id: this.sessionId,
        file_id: this.fileId!,
      };
      this.websocket!.send(JSON.stringify(heartbeat));
      this.lastHeartbeat = now;
    }
  };

  /********************************************
   * Receive Messages from Multiplayer Server *
   ********************************************/

  private handleMessage = (e: MessageEvent<string>) => {
    const data: ReceiveMessages = JSON.parse(e.data);
    switch (data.type) {
      case 'UsersInRoom':
        this.receiveUsersInRoom(data);
        break;

      case 'UserUpdate':
        multiplayerClient.sendUserUpdate(data);
        break;

      case 'Transaction':
        multiplayerCore.receiveTransaction(data);
        break;

      case 'Transactions':
        multiplayerCore.receiveTransactions(data.transactions);
        break;

      case 'EnterRoom':
        if (data.file_id !== this.fileId) throw new Error('Expected file_id to match in EnterRoom');
        multiplayerCore.receiveCurrentTransaction(data.sequence_num);
        break;

      case 'CurrentTransaction':
        multiplayerCore.receiveCurrentTransaction(data.sequence_num);
        break;

      case 'Error':
        if (data.error_level === 'Error') {
          // If the server is missing transactions, reload the page
          if (typeof data.error != 'string' && 'MissingTransactions' in data.error) {
            console.warn(
              `[Multiplayer] Warn: Missing transactions, expected ${data.error.MissingTransactions[0]}, but got  ${data.error.MissingTransactions[1]}`
            );
            multiplayerClient.reload();
            break;
          }

          Sentry.captureException({
            message: `Error response from the multiplayer server: ${data.error}`,
            level: 'error',
          });
          console.error(`[Multiplayer] Error`, data.error);
        } else {
          console.warn(`[Multiplayer] Error`, data.error);
        }
        break;

      default:
        if (data.type !== 'Empty') {
          console.warn(`Unknown message type: ${data}`);
        }
    }
  };

  private receiveUsersInRoom(room: ReceiveRoom) {
    multiplayerClient.sendUsersInRoom(room);
  }

  private send(message: MultiplayerServerMessage) {
    if (!this.websocket) throw new Error('Expected websocket to be defined in sendTransaction');
    this.websocket.send(JSON.stringify(message));
  }

  sendTransaction(transactionMessage: CoreMultiplayerTransaction) {
    if (this.state === 'connecting' || this.state === 'waiting to reconnect') {
      this.waitingForConnection.push(this.sendTransaction.bind(this, transactionMessage));
      return;
    }
    multiplayerClient.sendState('syncing');
    const message: SendTransaction = {
      type: 'Transaction',
      id: transactionMessage.transaction_id,
      session_id: this.sessionId!,
      file_id: this.fileId!,
      operations: transactionMessage.operations,
    };
    this.send(message);
  }

  requestTransactions(sequenceNum: number) {
    if (!this.sessionId) throw new Error('Expected sessionId to be defined in requestTransactions');
    if (!this.fileId) throw new Error('Expected fileId to be defined in requestTransactions');
    multiplayerClient.sendState('syncing');
    const message: SendGetTransactions = {
      type: 'GetTransactions',
      session_id: this.sessionId,
      file_id: this.fileId,
      min_sequence_num: sequenceNum,
    };
    this.send(message);
  }
}

export const multiplayerServer = new MultiplayerServer();
