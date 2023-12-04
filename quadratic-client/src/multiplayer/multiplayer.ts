import { pixiApp } from '@/gridGL/pixiApp/PixiApp';
import { Coordinate } from '@/gridGL/types/size';
import { User } from '@auth0/auth0-spa-js';
import { Rectangle } from 'pixi.js';
import { MULTIPLAYER_COLORS } from './multiplayerCursor/multiplayerColors';
import { MessageChangeSelection, MessageMouseMove, ReceiveMessages, SendEnterRoom } from './multiplayerTypes';

const UPDATE_TIME = 1000 / 30;

export interface Player {
  sheetId: string;
  x?: number;
  y?: number;
  name: string;
  picture: string;
  color: number;
  visible: boolean;
  selection?: { cursor: Coordinate; rectangle?: Rectangle };
}

export class Multiplayer {
  private websocket?: WebSocket;
  private ready = false;
  private room?: string;
  private uuid?: string;

  // queue of items waiting to be sent to the server on the next tick
  private queue: { move?: MessageMouseMove; selection?: MessageChangeSelection } = {};
  private lastTime = 0;

  // keep track of the next player's color index
  private nextColor = 0;

  players: Map<string, Player> = new Map();

  async init() {
    return new Promise((resolve) => {
      this.websocket = new WebSocket(import.meta.env.VITE_QUADRATIC_MULTIPLAYER_URL);
      this.websocket.addEventListener('message', this.handleMessage);
      this.websocket.addEventListener('close', async () => {
        console.log('[Multiplayer] websocket closed. Reconnecting...');
        this.ready = false;
        await this.init();
        if (this.room) await this.enterFileRoom(this.room, { sub: this.uuid });
      });
      this.websocket.addEventListener('open', () => {
        console.log('[Multiplayer] websocket initialized.');
        this.ready = true;
        resolve(0);
      });
    });
  }

  async enterFileRoom(uuid: string, user?: User) {
    if (!this.ready || !this.websocket) {
      throw new Error('[Multiplayer] Websocket not initialized.');
    }
    if (!user?.sub) throw new Error('Expected User to be defined');
    if (this.room === uuid) return;
    this.room = uuid;
    this.uuid = user.sub;
    const enterRoom: SendEnterRoom = {
      type: 'EnterRoom',

      // todo: not sure this is the correct user id
      user_id: user.sub,

      file_id: uuid,
      first_name: user.given_name ?? '',
      last_name: user.family_name ?? '',
      image: user.picture ?? '',
    };
    this.websocket.send(JSON.stringify(enterRoom));
    console.log(`[Multiplayer] Entered room.`);
  }

  sendMouseMove(x?: number, y?: number) {
    if (!this.ready || !this.websocket) {
      throw new Error('[Multiplayer] Websocket not initialized.');
    }
    if (x === undefined || y === undefined) {
      this.queue.move = {
        type: 'MouseMove',
        user_id: this.uuid!,
        file_id: this.room!,
      };
    } else {
      this.queue.move = {
        type: 'MouseMove',
        user_id: this.uuid!,
        file_id: this.room!,
        x,
        y,
      };
    }
  }

  sendSelection(cursor: Coordinate, rectangle?: Rectangle) {
    if (!this.ready || !this.websocket) {
      throw new Error('[Multiplayer] Websocket not initialized.');
    }
    this.queue.selection = {
      type: 'ChangeSelection',
      user_id: this.uuid!,
      file_id: this.room!,
      selection: JSON.stringify({ cursor, rectangle }),
    };
  }

  update() {
    if (!this.ready || !this.room || !this.uuid) return;
    if (!this.websocket) {
      throw new Error('[Multiplayer] Websocket not initialized.');
    }
    const now = performance.now();
    if (now - this.lastTime < UPDATE_TIME) return;
    if (this.queue.move) {
      this.websocket.send(JSON.stringify(this.queue.move));
      this.queue.move = undefined;
    }
    if (this.queue.selection) {
      this.websocket.send(JSON.stringify(this.queue.selection));
      this.queue.selection = undefined;
    }
    this.lastTime = now;
  }

  handleMessage = (e: { data: string }) => {
    const data = JSON.parse(e.data) as ReceiveMessages;
    const { type } = data;
    if (type === 'Room') {
      this.players.clear();
      const users = data.room.users;
      for (const userId in users) {
        // todo: this check should not be needed (eventually)
        if (userId !== this.uuid) {
          const user = users[userId];
          const { first_name, last_name, image } = user;
          this.players.set(userId, {
            name: `${first_name} ${last_name}`,
            picture: image,
            sheetId: '',
            x: 0,
            y: 0,
            color: this.nextColor,
            visible: false,
          });
          this.nextColor = (this.nextColor + 1) % MULTIPLAYER_COLORS.length;
          console.log(`[Multiplayer] Player ${userId} entered room.`);
        }
      }
    }
    if (type === 'MouseMove') {
      // todo: this check should not be needed (eventually)
      if (data.user_id !== this.uuid) {
        const player = this.players.get(data.user_id);
        if (!player) {
          throw new Error("Expected Player to be defined before receiving a message of type 'MouseMove'");
        }
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
      if (data.user_id !== this.uuid) {
        const player = this.players.get(data.user_id);
        if (!player) {
          throw new Error("Expected Player to be defined before receiving a message of type 'ChangeSelection'");
        }
        player.selection = JSON.parse(data.selection);
        pixiApp.multiplayerCursor.dirty = true;
      }
    }
  };
}

export const multiplayer = new Multiplayer();
