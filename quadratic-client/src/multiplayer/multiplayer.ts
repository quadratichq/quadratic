import { pixiApp } from '@/gridGL/pixiApp/PixiApp';
import { Coordinate } from '@/gridGL/types/size';
import { User } from '@auth0/auth0-spa-js';
import { Rectangle } from 'pixi.js';
import { MULTIPLAYER_COLORS } from './multiplayerCursor/multiplayerColors';

// todo: create types for messages

export interface Player {
  sheetId: string;
  x: number;
  y: number;
  name: string;
  picture: string;
  color: number;
  visible: boolean;
  selection?: { cursor: Coordinate; rectangle?: Rectangle };
}

class Multiplayer {
  private websocket?: WebSocket;
  private ready = false;
  private room?: string;
  private uuid?: string;

  // keep track of the next player's color index
  private nextColor = 0;

  players: Map<string, Player> = new Map();

  private async init() {
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
    // todo: hack to get around sharing bugged in ateam branch
    uuid = 'ae910c17-5988-41c7-a915-af90f56d6e69';

    if (!user) throw new Error('Expected User to be defined');
    if (this.room === uuid) return;
    this.room = uuid;
    this.uuid = user.sub;
    if (!this.ready) await this.init();
    if (!this.websocket) {
      throw new Error('[Multiplayer] Websocket not initialized.');
    }
    this.websocket.send(
      JSON.stringify({
        type: 'EnterRoom',

        // todo: not sure this is the correct user id
        user_id: user.sub,

        file_id: uuid,
        first_name: user.given_name,
        last_name: user.family_name,
        image: user.picture,
      })
    );
    console.log(`[Multiplayer] Entered room.`);
  }

  sendMouseMove(x: number, y: number) {
    if (!this.ready || !this.room || !this.uuid) return;
    if (!this.websocket) {
      throw new Error('[Multiplayer] Websocket not initialized.');
    }
    this.websocket.send(
      JSON.stringify({
        type: 'MouseMove',

        user_id: this.uuid,
        file_id: this.room,
        x,
        y,
      })
    );
  }

  sendSelection(cursor: Coordinate, rectangle?: Rectangle) {
    if (!this.ready || !this.room || !this.uuid) return;
    if (!this.websocket) {
      throw new Error('[Multiplayer] Websocket not initialized.');
    }
    this.websocket.send(
      JSON.stringify({
        type: 'ChangeSelection',

        user_id: this.uuid,
        file_id: this.room,
        selection: JSON.stringify({ cursor, rectangle }),
      })
    );
  }

  handleMessage = (e: any) => {
    const data = JSON.parse(e.data);
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
        player.x = data.x;
        player.y = data.y;
        player.visible = true;
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
