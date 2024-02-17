import { ReceiveEnterRoom } from './multiplayerTypes';

export interface MultiplayerClientEnterRoom {
  type: 'multiplayerClientEnterRoom';
  enterRoom: ReceiveEnterRoom;
}

export type MultiplayerCoreMessage = MultiplayerClientEnterRoom;

export type CoreMultiplayerMessage = { type: string };
