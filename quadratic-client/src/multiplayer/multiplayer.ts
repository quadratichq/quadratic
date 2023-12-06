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
import { Heartbeat, MessageTransaction, ReceiveMessages, ReceiveRoom, SendEnterRoom } from './multiplayerTypes';

const UPDATE_TIME = 1000 / 30;
const HEARTBEAT_TIME = 1000 * 30;

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
  private state: 'not connected' | 'connecting' | 'connected' = 'not connected';
  private sessionId = uuid();
  private room?: string;
  private uuid?: string;
  private waitingForConnection: { (value: unknown): void }[] = [];

  // queue of items waiting to be sent to the server on the next tick
  private queue: { move?: MessageMouseMove; selection?: MessageChangeSelection } = {};
  private lastTime = 0;
  private lastHeartbeat = 0;

  // keep track of the next player's color index
  private nextColor = 0;

  players: Map<string, Player> = new Map();

  private async init() {
    if (this.state === 'connected') return;
    return new Promise((resolve) => {
      if (this.state === 'connecting') {
        this.waitingForConnection.push(resolve);
        return;
      }

      this.state = 'connecting';
      this.websocket = new WebSocket(import.meta.env.VITE_QUADRATIC_MULTIPLAYER_URL);
      this.websocket.addEventListener('message', this.receiveMessage);

      // todo: this is not ideal. need to better handling reconnecting w/timeouts, etc.
      this.websocket.addEventListener('close', async () => {
        console.log('[Multiplayer] websocket closed. Reconnecting...');
        this.state = 'not connected';
        await this.init();
        if (this.room) await this.enterFileRoom(this.room, { sub: this.uuid });
      });

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

  async enterFileRoom(file_id: string, user?: User) {
    // used to hack the server so everyone is in the same file even if they're not.
    // file_id = 'ab96f02c-fd8c-4daa-bfb5-aec871ab9225';

    await this.init();
    if (!user?.sub) throw new Error('Expected User to be defined');
    if (this.room === file_id) return;
    this.room = file_id;
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
    if (this.queue.move) {
      this.websocket!.send(JSON.stringify(this.queue.move));
      this.queue.move = undefined;
      this.lastHeartbeat = now;
    }
    if (this.queue.selection) {
      this.websocket!.send(JSON.stringify(this.queue.selection));
      this.queue.selection = undefined;
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

  async sendMouseMove(x?: number, y?: number) {
    await this.init();
    if (x === undefined || y === undefined) {
      this.queue.move = {
        type: 'MouseMove',
        session_id: this.sessionId,
        file_id: this.room!,
      };
    } else {
      this.queue.move = {
        type: 'MouseMove',
        session_id: this.sessionId,
        file_id: this.room!,
        sheet_id: sheets.sheet.id,
        x,
        y,
      };
    }
  }

  async sendSelection(cursor: Coordinate, rectangle?: Rectangle) {
    await this.init();
    this.queue.selection = {
      type: 'ChangeSelection',
      session_id: this.sessionId,
      file_id: this.room!,
      selection: JSON.stringify({ cursor, rectangle }),
    };
  }

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

  async sendChangeSheet() {
    await this.init();
    const message: ChangeSheet = {
      type: 'ChangeSheet',
      session_id: this.sessionId,
      file_id: this.room!,
      sheet_id: sheets.sheet.id,
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

  private receiveMouseMove(data: MessageMouseMove) {
    // ensure we're not receiving our own message
    if (data.session_id !== this.sessionId) {
      const player = this.players.get(data.session_id);
      if (!player) {
        throw new Error("Expected Player to be defined before receiving a message of type 'MouseMove'");
      }
      if (data.file_id !== this.room) {
        throw new Error("Expected file_id to match room before receiving a message of type 'MouseMove'");
      }
      if (data.x !== null && data.y !== null) {
        player.x = data.x;
        player.y = data.y;
        player.visible = true;
      } else {
        player.visible = false;
      }
      if (player.sheetId === sheets.sheet.id) {
        window.dispatchEvent(new CustomEvent('multiplayer-cursor'));
      }
    }
  }

  private receiveSelection(data: MessageChangeSelection) {
    // todo: this check should not be needed (eventually)
    if (data.session_id !== this.sessionId) {
      const player = this.players.get(data.session_id);
      if (!player) {
        throw new Error("Expected Player to be defined before receiving a message of type 'ChangeSelection'");
      }
      if (data.file_id !== this.room) {
        throw new Error("Expected file_id to match room before receiving a message of type 'ChangeSelection'");
      }
      player.selection = JSON.parse(data.selection);
      pixiApp.multiplayerCursor.dirty = true;
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

  private receiveChangeSheet(data: ChangeSheet) {
    if (data.session_id !== this.sessionId) {
      if (data.file_id !== this.room) {
        throw new Error("Expected file_id to match room before receiving a message of type 'Transaction'");
      }
      const player = this.players.get(data.session_id);
      if (!player) {
        throw new Error("Expected Player to be defined before receiving a message of type 'ChangeSheet'");
      }
      player.sheetId = data.sheet_id;
      if (data.sheet_id === sheets.sheet.id) {
        this.updateMultiplayerCursors();
        window.dispatchEvent(new CustomEvent('multiplayer-cursor'));
      }
    }
  }

  receiveMessage = (e: { data: string }) => {
    const data = JSON.parse(e.data) as ReceiveMessages;
    const { type } = data;
    if (type === 'UsersInRoom') {
      this.receiveUsersInRoom(data);
    } else if (type === 'MouseMove') {
      this.receiveMouseMove(data);
    } else if (type === 'ChangeSelection') {
      this.receiveSelection(data);
    } else if (type === 'Transaction') {
      this.receiveTransaction(data);
    } else if (type === 'ChangeSheet') {
      this.receiveChangeSheet(data);
    } else {
      console.warn(`Unknown message type: ${type}`);
    }
  };
}

export const multiplayer = new Multiplayer();
