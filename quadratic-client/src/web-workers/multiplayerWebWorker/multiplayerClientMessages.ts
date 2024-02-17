import { User } from '@auth0/auth0-spa-js';
import { CellEdit, ReceiveRoom, UserUpdate } from './multiplayerTypes';

export type MultiplayerState =
  | 'startup'
  | 'no internet'
  | 'not connected'
  | 'connecting'
  | 'connected'
  | 'waiting to reconnect'
  | 'syncing';

export interface MultiplayerClientState {
  type: 'multiplayerClientState';
  state: MultiplayerState;
}

export interface MultiplayerClientUserUpdate {
  type: 'multiplayerClientUserUpdate';
  sessionId: string;
  fileId: string;
  userUpdate: UserUpdate;
}

export interface ClientMultiplayerInit {
  type: 'clientMultiplayerInit';
  fileId: string;
  user: User;
  anonymous: boolean;
  sessionId: string;
  sheetId: string;
  selection: string;
  cellEdit: CellEdit;
  viewport: string;
  codeRunning: string;
  follow?: string;
  x?: number;
  y?: number;
}

export interface ClientMultiplayerMouseMove {
  type: 'clientMultiplayerMouseMove';
  x?: number;
  y?: number;
}

export interface ClientMultiplayerSelection {
  type: 'clientMultiplayerSelection';
  selection: string;
}

export interface ClientMultiplayerSheet {
  type: 'clientMultiplayerSheet';
  sheetId: string;
}

export interface ClientMultiplayerCellEdit {
  type: 'clientMultiplayerCellEdit';
  cellEdit?: CellEdit;
}

export interface clientMultiplayerViewport {
  type: 'clientMultiplayerViewport';
  viewport: string;
}

export interface clientMultiplayerCodeRunning {
  type: 'clientMultiplayerCodeRunning';
  sheetPos: string;
}

export interface ClientMultiplayerFollow {
  type: 'clientMultiplayerFollow';
  follow: string;
}

export interface MultiplayerClientUsersInRoom {
  type: 'multiplayerClientUsersInRoom';
  room: ReceiveRoom;
}

export type MultiplayerClientMessage =
  | MultiplayerClientState
  | MultiplayerClientUserUpdate
  | MultiplayerClientUsersInRoom
  | MultiplayerClientUserUpdate;

export type ClientMultiplayerMessage =
  | ClientMultiplayerInit
  | ClientMultiplayerMouseMove
  | ClientMultiplayerSelection
  | ClientMultiplayerSheet
  | ClientMultiplayerCellEdit
  | clientMultiplayerViewport
  | clientMultiplayerCodeRunning
  | ClientMultiplayerFollow;
