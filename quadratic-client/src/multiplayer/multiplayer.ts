import { grid } from '@/grid/controller/Grid';
import { pixiApp } from '@/gridGL/pixiApp/PixiApp';
import { Coordinate } from '@/gridGL/types/size';
import { SimpleMultiplayerUser } from '@/ui/menus/TopBar/useMultiplayerUsers';
import { User } from '@auth0/auth0-spa-js';
import { Rectangle } from 'pixi.js';
import { v4 as uuid } from 'uuid';
import { MULTIPLAYER_COLORS } from './multiplayerCursor/multiplayerColors';
import {
  MessageChangeSelection,
  MessageMouseMove,
  MessageTransaction,
  ReceiveMessages,
  ReceiveRoom,
  SendEnterRoom,
} from './multiplayerTypes';

const UPDATE_TIME = 1000 / 30;

export interface Player {
  firstName: string;
  lastName: string;
  sessionId: string;
  userId: string;
  sheetId: string;
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
      this.websocket.addEventListener('message', this.handleMessage);

      // todo: this is not ideal. need to better handling reconnecting w/timeouts, etc.
      this.websocket.addEventListener('close', async () => {
        console.log('[Multiplayer] websocket closed. Reconnecting...');
        this.state = 'not connected';
        await this.init();
        if (this.room) await this.enterFileRoom(this.room, { sub: this.uuid });
      });

      this.websocket.addEventListener('open', () => {
        console.log('[Multiplayer] websocket initialized.');
        this.state = 'connected';
        this.waitingForConnection.forEach((resolve) => resolve(0));
        resolve(0);
        this.waitingForConnection = [];
      });
    });
  }

  async enterFileRoom(file_id: string, user?: User) {
    // used to hack the server so everyone is in the same file even if they're not.
    file_id = 'ab96f02c-fd8c-4daa-bfb5-aec871ab9225';

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
    console.log(`[Multiplayer] Entered room.`);
  }

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

  async update() {
    await this.init();
    const now = performance.now();
    if (now - this.lastTime < UPDATE_TIME) return;
    if (this.queue.move) {
      this.websocket!.send(JSON.stringify(this.queue.move));
      this.queue.move = undefined;
    }
    if (this.queue.selection) {
      this.websocket!.send(JSON.stringify(this.queue.selection));
      this.queue.selection = undefined;
    }
    this.lastTime = now;
  }

  private updateHook() {
    const players: SimpleMultiplayerUser[] = [];
    this.players.forEach((player) => {
      players.push({
        sessionId: player.sessionId,
        userId: player.userId,
        firstName: player.firstName,
        lastName: player.lastName,
        picture: player.image,
        color: player.color,
      });
    });
    window.dispatchEvent(new CustomEvent('multiplayer-update', { detail: players }));
  }

  handleMessage = (e: { data: string }) => {
    const data = JSON.parse(e.data) as ReceiveMessages;
    const { type } = data;
    if (type === 'Room') {
      const room = data as ReceiveRoom;
      const remaining = new Set(this.players.keys());
      for (const user of room.users) {
        const player = this.players.get(user.session_id);
        if (player) {
          player.firstName = user.first_name;
          player.lastName = user.last_name;
          player.image = user.image;
          remaining.delete(user.session_id);
          console.log(`[Multiplayer] Player ${user.first_name} entered room.`);
        } else {
          this.players.set(user.session_id, {
            sessionId: user.session_id,
            userId: user.user_id,
            firstName: user.first_name,
            lastName: user.last_name,
            image: user.image,
            sheetId: '',
            x: 0,
            y: 0,
            color: this.nextColor,
            visible: false,
          });
          this.nextColor = (this.nextColor + 1) % MULTIPLAYER_COLORS.length;
          console.log(`[Multiplayer] Player ${user.first_name} entered room.`);
        }
        remaining.forEach((sessionId) => {
          this.players.delete(sessionId);
        });
        this.updateHook();
      }
    } else if (type === 'MouseMove') {
      const player = this.players.get(data.session_id);
      if (!player) {
        throw new Error("Expected Player to be defined before receiving a message of type 'MouseMove'");
      }
      // todo: this check should not be needed (eventually)
      if (data.session_id !== this.sessionId) {
        if (data.x !== null && data.y !== null) {
          player.x = data.x;
          player.y = data.y;
          player.visible = true;
        } else {
          player.visible = false;
        }
        window.dispatchEvent(new CustomEvent('multiplayer-cursor'));
      }
    } else if (type === 'ChangeSelection') {
      // todo: this check should not be needed (eventually)
      if (data.session_id !== this.sessionId) {
        const player = this.players.get(data.session_id);
        if (!player) {
          throw new Error("Expected Player to be defined before receiving a message of type 'ChangeSelection'");
        }
        player.selection = JSON.parse(data.selection);
        pixiApp.multiplayerCursor.dirty = true;
      }
    } else if (type === 'Transaction') {
      // todo: this check should not be needed (eventually)
      if (data.session_id !== this.uuid) {
        grid.multiplayerTransaction(data.operations);
      }
    } else {
      console.warn(`Unknown message type: ${type}`);
    }
  };
}

export const multiplayer = new Multiplayer();
