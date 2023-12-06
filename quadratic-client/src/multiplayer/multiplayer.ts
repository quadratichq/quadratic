import { debugShowMultiplayer } from '@/debugFlags';
import { grid } from '@/grid/controller/Grid';
import { sheets } from '@/grid/controller/Sheets';
import { pixiApp } from '@/gridGL/pixiApp/PixiApp';
import { Coordinate } from '@/gridGL/types/size';
import { SimpleMultiplayerUser } from '@/ui/menus/TopBar/useMultiplayerUsers';
import { User } from '@auth0/auth0-spa-js';
import { Rectangle } from 'pixi.js';
import { v4 as uuid } from 'uuid';
import { MULTIPLAYER_COLORS } from './multiplayerCursor/multiplayerColors';
import {
  Heartbeat,
  MessageTransaction,
  MessageUserUpdate,
  ReceiveMessages,
  ReceiveRoom,
  SendEnterRoom,
} from './multiplayerTypes';

const UPDATE_TIME = 1000 / 30;
const HEARTBEAT_TIME = 1000 * 15;
const RECONNECT_AFTER_ERROR_TIMEOUT = 1000 * 5;

export interface Player {
  firstName: string;
  lastName: string;
  sessionId: string;
  userId: string;
  sheetId?: string;
  x?: number;
  y?: number;
  image: string;
  color: number;
  visible: boolean;
  selection?: { cursor: Coordinate; rectangle?: Rectangle };
}

export class Multiplayer {
  private websocket?: WebSocket;
  private state: 'not connected' | 'connecting' | 'connected' | 'waiting to reconnect';
  private sessionId;
  private room?: string;
  private uuid?: string;
  private waitingForConnection: { (value: unknown): void }[] = [];

  // queue of items waiting to be sent to the server on the next tick
  private userUpdate: MessageUserUpdate;
  private lastTime = 0;
  private lastHeartbeat = 0;

  // keep track of the next player's color index
  private nextColor = 0;

  players: Map<string, Player> = new Map();

  constructor() {
    this.state = 'not connected';
    this.sessionId = uuid();
    this.userUpdate = { type: 'UserUpdate', session_id: this.sessionId, file_id: '', update: {} };
  }

  private async init() {
    if (['connected', 'waiting to reconnect'].includes(this.state)) return;
    return new Promise((resolve) => {
      if (this.state === 'connecting') {
        this.waitingForConnection.push(resolve);
        return;
      }

      this.state = 'connecting';
      this.websocket = new WebSocket(import.meta.env.VITE_QUADRATIC_MULTIPLAYER_URL);
      this.websocket.addEventListener('message', this.receiveMessage);

      this.websocket.addEventListener('close', this.reconnect);
      this.websocket.addEventListener('error', this.reconnect);

      this.websocket.addEventListener('open', () => {
        console.log('[Multiplayer] websocket connected.');
        this.state = 'connected';
        this.waitingForConnection.forEach((resolve) => resolve(0));
        resolve(0);
        this.waitingForConnection = [];
        this.lastHeartbeat = Date.now();
        window.addEventListener('change-sheet', this.sendChangeSheet);
      });
    });
  }

  private reconnect = () => {
    console.log('[Multiplayer] websocket closed. Reconnecting in 5s...');
    this.state = 'waiting to reconnect';
    setTimeout(async () => {
      this.state = 'not connected';
      await this.init();
      if (this.room) await this.enterFileRoom(this.room, { sub: this.uuid });
    }, RECONNECT_AFTER_ERROR_TIMEOUT);
  };

  async enterFileRoom(file_id: string, user?: User) {
    // used to hack the server so everyone is in the same file even if they're not.
    // file_id = 'ab96f02c-fd8c-4daa-bfb5-aec871ab9225';

    this.userUpdate.file_id = file_id;
    await this.init();
    if (!user?.sub) throw new Error('Expected User to be defined');
    if (this.room === file_id) return;
    this.room = file_id;
    this.uuid = user.sub;
    const enterRoom: SendEnterRoom = {
      type: 'EnterRoom',
      session_id: this.sessionId,
      user_id: user.sub,
      file_id,
      first_name: user.given_name ?? '',
      last_name: user.family_name ?? '',
      image: user.picture ?? '',
    };
    this.websocket!.send(JSON.stringify(enterRoom));
    if (debugShowMultiplayer) console.log(`[Multiplayer] Joined room ${file_id}.`);
  }

  async update() {
    await this.init();
    const now = performance.now();
    if (now - this.lastTime < UPDATE_TIME) return;

    if (Object.keys(this.userUpdate.update).length > 0) {
      this.websocket!.send(JSON.stringify(this.userUpdate));
      this.userUpdate.update = {};
      this.lastHeartbeat = now;
    }
    this.lastTime = now;
    if (now - this.lastHeartbeat > HEARTBEAT_TIME) {
      const heartbeat: Heartbeat = {
        type: 'Heartbeat',
        session_id: this.sessionId,
        file_id: this.room!,
      };
      this.websocket!.send(JSON.stringify(heartbeat));
      if (debugShowMultiplayer) console.log('[Multiplayer] Sending heartbeat...');
      this.lastHeartbeat = now;
    }
  }

  //#region send messages
  //-------------------------

  private getUserUpdate(): MessageUserUpdate {
    if (!this.userUpdate) {
      this.userUpdate = {
        type: 'UserUpdate',
        session_id: this.sessionId,
        file_id: this.room!,
        update: {},
      };
    }
    return this.userUpdate;
  }

  async sendMouseMove(x?: number, y?: number) {
    const userUpdate = this.getUserUpdate().update;
    if (x === undefined || y === undefined) {
      userUpdate.visible = false;
    } else {
      userUpdate.x = x;
      userUpdate.y = y;
      userUpdate.visible = true;
    }
  }

  async sendSelection(cursor: Coordinate, rectangle?: Rectangle) {
    const userUpdate = this.getUserUpdate().update;
    userUpdate.selection = JSON.stringify({ cursor, rectangle });
  }

  sendChangeSheet = () => {
    const userUpdate = this.getUserUpdate().update;
    userUpdate.sheet_id = sheets.sheet.id;
  };

  async sendTransaction(operations: string) {
    await this.init();
    const message: MessageTransaction = {
      type: 'Transaction',
      session_id: this.sessionId,
      file_id: this.room!,
      operations,
    };
    this.websocket!.send(JSON.stringify(message));
  }

  //#endregion

  //#region receive messages
  //-------------------------

  // updates the React hook to populate the Avatar list
  private receiveUsersInRoom(room: ReceiveRoom) {
    const players: SimpleMultiplayerUser[] = [];
    const remaining = new Set(this.players.keys());
    if (debugShowMultiplayer) console.log(`[Multiplayer] Room size before UsersInRoom message: ${remaining.size}`);
    for (const user of room.users) {
      if (user.session_id !== this.sessionId) {
        let player = this.players.get(user.session_id);
        if (player) {
          player.firstName = user.first_name;
          player.lastName = user.last_name;
          player.image = user.image;
          player.selection = user.selection ? JSON.parse(user.selection) : undefined;
          remaining.delete(user.session_id);
          if (debugShowMultiplayer) console.log(`[Multiplayer] Updated player ${user.first_name}.`);
        } else {
          player = {
            sessionId: user.session_id,
            userId: user.user_id,
            firstName: user.first_name,
            lastName: user.last_name,
            image: user.image,
            sheetId: user.sheet_id,
            selection: user.selection ? JSON.parse(user.selection) : undefined,
            x: 0,
            y: 0,
            color: this.nextColor,
            visible: false,
          };
          this.players.set(user.session_id, player);
          this.nextColor = (this.nextColor + 1) % MULTIPLAYER_COLORS.length;
          if (debugShowMultiplayer) console.log(`[Multiplayer] Player ${user.first_name} entered room.`);
        }
        players.push({
          sessionId: player.sessionId,
          userId: player.userId,
          firstName: player.firstName,
          lastName: player.lastName,
          picture: player.image,
          color: player.color,
        });
      }
    }
    remaining.forEach((sessionId) => {
      if (debugShowMultiplayer)
        console.log(`[Multiplayer] Player ${this.players.get(sessionId)?.firstName} left room.`);
      this.players.delete(sessionId);
    });
    console.log(`[Multiplayer] Room size after UsersInRoom message: ${this.players.size}`);
    window.dispatchEvent(new CustomEvent('multiplayer-update', { detail: players }));
    this.updateMultiplayerCursors();
  }

  private updateMultiplayerCursors() {
    // multiplayer may be initiated before pixiApp is created
    if (pixiApp?.multiplayerCursor) {
      pixiApp.multiplayerCursor.dirty = true;
    }
  }

  private receiveUserUpdate(data: MessageUserUpdate) {
    // this eventually will not be necessarily
    if (data.session_id === this.sessionId) return;
    const player = this.players.get(data.session_id);
    if (!player) {
      throw new Error("Expected Player to be defined before receiving a message of type 'MouseMove'");
    }
    if (data.file_id !== this.room) {
      throw new Error("Expected file_id to match room before receiving a message of type 'MouseMove'");
    }
    const update = data.update;

    if (update.x !== null && update.y !== null) {
      player.x = update.x;
      player.y = update.y;
      if (player.sheetId === sheets.sheet.id) {
        window.dispatchEvent(new CustomEvent('multiplayer-cursor'));
      }
    }

    if (update.visible !== undefined) {
      player.visible = update.visible;
    }

    if (update.sheet_id) {
      if (player.sheetId !== update.sheet_id) {
        player.sheetId = update.sheet_id;
        if (player.sheetId === sheets.sheet.id) {
          this.updateMultiplayerCursors();
          window.dispatchEvent(new CustomEvent('multiplayer-cursor'));
        }
      }
    }

    if (update.selection) {
      player.selection = JSON.parse(update.selection);
      if (player.sheetId === sheets.sheet.id) {
        pixiApp.multiplayerCursor.dirty = true;
      }
    }
  }

  private receiveTransaction(data: MessageTransaction) {
    // todo: this check should not be needed (eventually)
    if (data.session_id !== this.sessionId) {
      if (data.file_id !== this.room) {
        throw new Error("Expected file_id to match room before receiving a message of type 'Transaction'");
      }
      grid.multiplayerTransaction(data.operations);
    }
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
    } else if (type !== 'Empty') {
      console.warn(`Unknown message type: ${type}`);
    }
  };
}

export const multiplayer = new Multiplayer();
