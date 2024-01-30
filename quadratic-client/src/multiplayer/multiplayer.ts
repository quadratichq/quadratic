import { authClient, parseDomain } from '@/auth';
import { debugShowMultiplayer } from '@/debugFlags';
import { grid } from '@/grid/controller/Grid';
import { sheets } from '@/grid/controller/Sheets';
import { offline } from '@/grid/controller/offline';
import { pixiApp } from '@/gridGL/pixiApp/PixiApp';
import { pixiAppSettings } from '@/gridGL/pixiApp/PixiAppSettings';
import { SheetPos } from '@/gridGL/types/size';
import { displayName } from '@/utils/userUtil';
import { pythonWebWorker } from '@/web-workers/pythonWebWorker/python';
import { User } from '@auth0/auth0-spa-js';
import { v4 as uuid } from 'uuid';
import { MULTIPLAYER_COLORS, MULTIPLAYER_COLORS_TINT } from '../gridGL/HTMLGrid/multiplayerCursor/multiplayerColors';
import {
  Heartbeat,
  MessageUserUpdate,
  MultiplayerUser,
  ReceiveCurrentTransaction,
  ReceiveEnterRoom,
  ReceiveMessages,
  ReceiveRoom,
  ReceiveTransaction,
  ReceiveTransactions,
  SendEnterRoom,
  SendGetTransactions,
  SendTransaction,
} from './multiplayerTypes';

const UPDATE_TIME = 1000 / 30;
const HEARTBEAT_TIME = 1000 * 10;
const RECONNECT_AFTER_ERROR_TIMEOUT = 1000 * 5;

export type MultiplayerState =
  | 'startup'
  | 'no internet'
  | 'not connected'
  | 'connecting'
  | 'connected'
  | 'waiting to reconnect'
  | 'syncing';

export class Multiplayer {
  private websocket?: WebSocket;
  private _state: MultiplayerState = 'startup';
  private updateId?: number;
  private sessionId;
  private fileId?: string;
  private user?: User;
  private anonymous?: boolean;
  private jwt?: string | void;
  private lastMouseMove: { x: number; y: number } | undefined;

  private connectionTimeout: number | undefined;

  // messages pending a reconnect
  private waitingForConnection: { (value: unknown): void }[] = [];

  // queue of items waiting to be sent to the server on the next tick
  private userUpdate: MessageUserUpdate;
  private lastHeartbeat = 0;

  // next player's color index
  private nextColor = 0;

  // users currently logged in to the room
  users: Map<string, MultiplayerUser> = new Map();

  constructor() {
    this.sessionId = uuid();
    this.userUpdate = { type: 'UserUpdate', session_id: this.sessionId, file_id: '', update: {} };
    window.addEventListener('online', () => {
      if (this.state === 'no internet') {
        this.state = 'not connected';
        this.init();
      }
    });
    window.addEventListener('offline', () => {
      this.state = 'no internet';
      this.websocket?.close();
    });
  }

  get state() {
    return this._state;
  }
  private set state(state: MultiplayerState) {
    this._state = state;
    if (state === 'no internet' || state === 'waiting to reconnect') {
      this.clearAllUsers();
    }
    window.dispatchEvent(new CustomEvent('multiplayer-state', { detail: state }));
  }

  private async getJwt() {
    this.jwt = await authClient.getToken();
  }

  private async addJwtCookie(force: boolean = false) {
    if (force || !this.jwt) {
      await this.getJwt();

      if (this.jwt) {
        let domain = parseDomain(window.location.host);
        document.cookie = `jwt=${this.jwt}; path=/; domain=${domain};`;
      }
    }
  }

  async init(file_id?: string, user?: User, anonymous?: boolean) {
    if (this.state === 'connected' || this.state === 'syncing') return;

    if (file_id) {
      this.fileId = file_id;
      this.user = user;
      this.anonymous = anonymous;
      this.userUpdate.file_id = file_id;
    }

    if (!this.anonymous) {
      await this.addJwtCookie();
    }

    return new Promise((resolve) => {
      if (this.state === 'connecting' || this.state === 'waiting to reconnect') {
        this.waitingForConnection.push(resolve);
        return;
      }

      this.state = 'connecting';
      this.websocket = new WebSocket(import.meta.env.VITE_QUADRATIC_MULTIPLAYER_URL);
      this.websocket.addEventListener('message', this.receiveMessage);

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
        console.log('[Multiplayer] websocket connected.');
        this.state = 'connected';
        this.enterFileRoom();
        this.waitingForConnection.forEach((resolve) => resolve(0));
        this.waitingForConnection = [];
        this.lastHeartbeat = Date.now();
        window.addEventListener('change-sheet', this.sendChangeSheet);

        if (!this.updateId) {
          this.updateId = window.setInterval(multiplayer.update, UPDATE_TIME);
        }
      });
    });
  }

  private reconnect = () => {
    if (this.state === 'no internet' || this.connectionTimeout) return;
    console.log(`[Multiplayer] websocket closed. Reconnecting in ${RECONNECT_AFTER_ERROR_TIMEOUT / 1000}s...`);
    this.state = 'waiting to reconnect';
    this.connectionTimeout = window.setTimeout(async () => {
      this.state = 'not connected';
      this.connectionTimeout = undefined;
      await this.init();
    }, RECONNECT_AFTER_ERROR_TIMEOUT);
  };

  // multiplayer for a file
  async enterFileRoom() {
    if (!this.websocket) throw new Error('Expected websocket to be defined in enterFileRoom');
    if (!this.fileId) throw new Error('Expected fileId to be defined in enterFileRoom');
    const user = this.user;
    if (!user?.sub) throw new Error('Expected user to be defined in enterFileRoom');
    // ensure the user doesn't join a room twice
    const enterRoom: SendEnterRoom = {
      type: 'EnterRoom',
      session_id: this.sessionId,
      user_id: user.sub,
      file_id: this.fileId,
      sheet_id: sheets.sheet.id,
      selection: sheets.getMultiplayerSelection(),
      first_name: user.given_name ?? '',
      last_name: user.family_name ?? '',
      email: user.email ?? '',
      image: user.picture ?? '',
      cell_edit: {
        active: pixiAppSettings.input.show,
        text: pixiAppSettings.input.value ?? '',
        cursor: pixiAppSettings.input.cursor ?? 0,
        code_editor: pixiAppSettings.editorInteractionState.showCodeEditor,
      },
      x: 0,
      y: 0,
      visible: false,
      viewport: pixiApp.saveMultiplayerViewport(),
      code_running: JSON.stringify(pythonWebWorker.getCodeRunning()),
    };
    this.websocket.send(JSON.stringify(enterRoom));
    offline.loadTransactions();
    if (debugShowMultiplayer) console.log(`[Multiplayer] Joined room ${this.fileId}.`);
  }

  // called by Update.ts
  private update = () => {
    if (!navigator.onLine || this.state !== 'connected') return;
    const now = performance.now();

    if (Object.keys(this.userUpdate.update).length > 0) {
      this.websocket!.send(JSON.stringify(this.userUpdate));
      this.userUpdate.update = {};
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

  // used to pre-populate useMultiplayerUsers.tsx
  getUsers(): MultiplayerUser[] {
    return Array.from(this.users.values());
  }

  // whether a multiplayer user is already editing a cell
  cellIsBeingEdited(x: number, y: number, sheetId: string): { codeEditor: boolean; user: string } | undefined {
    for (const player of this.users.values()) {
      if (player.sheet_id === sheetId && player.cell_edit.active && player.parsedSelection) {
        if (player.parsedSelection.cursor.x === x && player.parsedSelection.cursor.y === y) {
          const user = displayName(player, false);
          return { codeEditor: player.cell_edit.code_editor, user };
        }
      }
    }
  }

  //#region send messages
  //-------------------------

  private getUserUpdate(): MessageUserUpdate {
    if (!this.userUpdate) {
      this.userUpdate = {
        type: 'UserUpdate',
        session_id: this.sessionId,
        file_id: this.fileId!,
        update: {},
      };
    }
    return this.userUpdate;
  }

  async sendMouseMove(x?: number, y?: number) {
    if (this.lastMouseMove === undefined && x === undefined) return;
    if (this.lastMouseMove && this.lastMouseMove.x === x && this.lastMouseMove.y === y) return;
    const userUpdate = this.getUserUpdate().update;
    if (x === undefined || y === undefined) {
      userUpdate.visible = false;
    } else {
      userUpdate.x = x;
      userUpdate.y = y;
      userUpdate.visible = true;
    }
    this.lastMouseMove = x === undefined || y === undefined ? undefined : { x, y };
  }

  async sendSelection(selection: string) {
    const userUpdate = this.getUserUpdate().update;
    userUpdate.selection = selection;
  }

  sendChangeSheet = () => {
    const userUpdate = this.getUserUpdate().update;
    userUpdate.sheet_id = sheets.sheet.id;
  };

  sendCellEdit(text: string, cursor: number, codeEditor: boolean, bold?: boolean, italic?: boolean) {
    const userUpdate = this.getUserUpdate().update;
    userUpdate.cell_edit = {
      text,
      cursor,
      active: true,
      code_editor: codeEditor,
      bold,
      italic,
    };
  }

  sendEndCellEdit() {
    const userUpdate = this.getUserUpdate().update;
    userUpdate.cell_edit = {
      text: '',
      cursor: 0,
      active: false,
      code_editor: false,
    };
  }

  sendViewport(viewport: string) {
    const userUpdate = this.getUserUpdate().update;
    userUpdate.viewport = viewport;
  }

  sendCodeRunning(sheetPos: SheetPos[]) {
    const userUpdate = this.getUserUpdate().update;
    userUpdate.code_running = JSON.stringify(sheetPos);
  }

  async sendTransaction(id: string, operations: string) {
    await this.init();
    if (!this.websocket) throw new Error('Expected websocket to be defined in sendTransaction');
    // it's possible that we try to send a transaction before we've entered a room (eg, unsent_transactions)
    if (!this.fileId) return;
    const message: SendTransaction = {
      type: 'Transaction',
      id,
      session_id: this.sessionId,
      file_id: this.fileId,
      operations,
    };
    this.state = 'syncing';
    this.websocket.send(JSON.stringify(message));
    if (debugShowMultiplayer) console.log(`[Multiplayer] Sent transaction ${id}.`);
  }

  async sendGetTransactions(min_sequence_num: bigint) {
    await this.init();
    if (!this.websocket) throw new Error('Expected websocket to be defined in sendGetTransactions');
    const message: SendGetTransactions = {
      type: 'GetTransactions',
      session_id: this.sessionId,
      file_id: this.fileId!,
      min_sequence_num,
    };
    if (debugShowMultiplayer) console.log(`[Multiplayer] Requesting transactions starting from ${min_sequence_num}.`);
    this.websocket.send(JSON.stringify(message));
    this.state = 'syncing';
  }

  //#endregion

  //#region receive messages
  //-------------------------

  // updates the React hook to populate the Avatar list
  private receiveUsersInRoom(room: ReceiveRoom) {
    const remaining = new Set(this.users.keys());
    for (const user of room.users) {
      if (user.session_id !== this.sessionId) {
        let player = this.users.get(user.session_id);
        if (player) {
          player.first_name = user.first_name;
          player.last_name = user.last_name;
          player.image = user.image;
          player.sheet_id = user.sheet_id;
          player.selection = user.selection;
          player.parsedSelection = user.selection ? JSON.parse(user.selection) : undefined;
          remaining.delete(user.session_id);
          if (debugShowMultiplayer) console.log(`[Multiplayer] Updated player ${user.first_name}.`);
        } else {
          player = {
            session_id: user.session_id,
            file_id: user.file_id,
            user_id: user.user_id,
            first_name: user.first_name,
            last_name: user.last_name,
            email: user.email,
            image: user.image,
            sheet_id: user.sheet_id,
            selection: user.selection,
            parsedSelection: user.selection ? JSON.parse(user.selection) : undefined,
            cell_edit: user.cell_edit,
            x: 0,
            y: 0,
            color: MULTIPLAYER_COLORS_TINT[this.nextColor],
            colorString: MULTIPLAYER_COLORS[this.nextColor],
            visible: false,
            index: this.users.size,
            viewport: user.viewport,
            code_running: user.code_running,
            parsedCodeRunning: user.code_running ? JSON.parse(user.code_running) : [],
          };
          this.users.set(user.session_id, player);
          this.nextColor = (this.nextColor + 1) % MULTIPLAYER_COLORS.length;
          if (debugShowMultiplayer) console.log(`[Multiplayer] Player ${user.first_name} entered room.`);
        }
      }
    }
    remaining.forEach((sessionId) => {
      if (debugShowMultiplayer) console.log(`[Multiplayer] Player ${this.users.get(sessionId)?.first_name} left room.`);
      this.users.delete(sessionId);
    });
    window.dispatchEvent(new CustomEvent('multiplayer-update', { detail: this.getUsers() }));
    pixiApp.multiplayerCursor.dirty = true;
  }

  private clearAllUsers() {
    if (debugShowMultiplayer) console.log('[Multiplayer] Clearing all users.');
    this.users.clear();
    pixiApp.multiplayerCursor.dirty = true;
    window.dispatchEvent(new CustomEvent('multiplayer-update', { detail: this.getUsers() }));
    window.dispatchEvent(new CustomEvent('multiplayer-change-sheet'));
    window.dispatchEvent(new CustomEvent('multiplayer-cursor'));
  }

  private receiveUserUpdate(data: MessageUserUpdate) {
    // this eventually will not be necessarily
    if (data.session_id === this.sessionId) return;
    const player = this.users.get(data.session_id);

    // it's possible we get the UserUpdate before the EnterRoom response. No big deal if we do.
    if (!player) return;

    if (data.file_id !== this.fileId) {
      throw new Error("Expected file_id to match room before receiving a message of type 'MouseMove'");
    }
    const update = data.update;

    if (update.x !== null && update.y !== null) {
      player.x = update.x;
      player.y = update.y;
      if (player.sheet_id === sheets.sheet.id) {
        window.dispatchEvent(new CustomEvent('multiplayer-cursor'));
      }
    }

    if (update.visible !== undefined) {
      player.visible = update.visible;
    }

    if (update.sheet_id) {
      if (player.sheet_id !== update.sheet_id) {
        player.sheet_id = update.sheet_id;
        window.dispatchEvent(new CustomEvent('multiplayer-change-sheet'));
        if (player.sheet_id === sheets.sheet.id) {
          pixiApp.multiplayerCursor.dirty = true;
          window.dispatchEvent(new CustomEvent('multiplayer-cursor'));
        }
      }
    }

    if (update.selection) {
      player.selection = update.selection;
      player.parsedSelection = player.selection ? JSON.parse(player.selection) : undefined;
      if (player.sheet_id === sheets.sheet.id) {
        pixiApp.multiplayerCursor.dirty = true;
      }
    }

    if (update.cell_edit) {
      player.cell_edit = update.cell_edit;
      if (!update.cell_edit.code_editor) {
        if (player.parsedSelection) {
          // hide the label if the player is editing the cell
          pixiApp.cellsSheets.showLabel(
            player.parsedSelection.cursor.x,
            player.parsedSelection.cursor.y,
            player.sheet_id,
            !player.cell_edit.active
          );
        }
        window.dispatchEvent(
          new CustomEvent('multiplayer-cell-edit', {
            detail: {
              ...update.cell_edit,
              playerColor: player.color,
              sessionId: data.session_id,
              sheetId: player.sheet_id,
              cell: player.parsedSelection?.cursor,
            },
          })
        );
      }
      pixiApp.multiplayerCursor.dirty = true;
    }

    if (update.viewport) {
      player.viewport = update.viewport;
      if (pixiAppSettings.editorInteractionState.follow === player.session_id) {
        pixiApp.loadMultiplayerViewport(JSON.parse(player.viewport));
      }
    }

    if (update.code_running) {
      player.code_running = update.code_running;
      player.parsedCodeRunning = JSON.parse(update.code_running);

      // trigger changes in CodeRunning.tsx
      dispatchEvent(new CustomEvent('python-change'));
    }
  }

  // Receives a new transaction from the server
  private async receiveTransaction(data: ReceiveTransaction) {
    if (data.file_id !== this.fileId) {
      throw new Error("Expected file_id to match room before receiving a message of type 'Transaction'");
    }
    grid.multiplayerTransaction(data.id, data.sequence_num, data.operations);
    offline.markTransactionSent(data.id);
    if (await offline.unsentTransactionsCount()) {
      this.state = 'syncing';
    } else {
      this.state = 'connected';
    }
  }

  // Receives a collection of transactions to catch us up based on our sequenceNum
  private async receiveTransactions(data: ReceiveTransactions) {
    grid.receiveMultiplayerTransactions(data.transactions);
    if (await offline.unsentTransactionsCount()) {
      this.state = 'syncing';
    } else {
      this.state = 'connected';
    }
  }

  // Receives the current transaction number from the server when entering a room.
  // Note: this may be different than the one provided by the api as there may be unsaved Transactions.
  private receiveEnterRoom(data: ReceiveEnterRoom) {
    if (data.file_id !== this.fileId) {
      throw new Error("Expected file_id to match room before receiving a message of type 'EnterRoom'");
    }
    grid.receiveSequenceNum(data.sequence_num);
  }

  // Called during a heartbeat from the server to verify we're at the correct sequenceNum
  private receiveCurrentTransaction(data: ReceiveCurrentTransaction) {
    grid.receiveSequenceNum(data.sequence_num);
  }

  receiveMessage = (e: { data: string }) => {
    const data = JSON.parse(e.data) as ReceiveMessages;
    const { type } = data;
    if (type === 'UsersInRoom') {
      this.receiveUsersInRoom(data);
    } else if (type === 'UserUpdate') {
      this.receiveUserUpdate(data);
    } else if (type === 'Transaction') {
      this.receiveTransaction(data);
    } else if (type === 'Transactions') {
      this.receiveTransactions(data);
    } else if (type === 'EnterRoom') {
      this.receiveEnterRoom(data);
    } else if (type === 'CurrentTransaction') {
      this.receiveCurrentTransaction(data);
    } else if (type === 'Error') {
      console.warn(`[Multiplayer] Error`, data.error);
    } else if (type !== 'Empty') {
      console.warn(`Unknown message type: ${type}`);
    }
  };
}

export const multiplayer = new Multiplayer();

window.sendTransaction = multiplayer.sendTransaction.bind(multiplayer);
