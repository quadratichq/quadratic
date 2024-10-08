import { User } from '@/auth/auth';
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
  visible: boolean;
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

export interface ClientMultiplayerViewport {
  type: 'clientMultiplayerViewport';
  viewport: string;
}

export interface ClientMultiplayerCodeRunning {
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

export interface MultiplayerClientReload {
  type: 'multiplayerClientReload';
}

export interface MultiplayerClientRefreshJwt {
  type: 'multiplayerClientRefreshJwt';
  id: number;
}

export interface ClientMultiplayerRefreshJwt {
  type: 'clientMultiplayerRefreshJwt';
  id: number;
}

export interface ClientMultiplayerOnline {
  type: 'clientMultiplayerOnline';
}

export interface ClientMultiplayerOffline {
  type: 'clientMultiplayerOffline';
}

export type MultiplayerClientMessage =
  | MultiplayerClientState
  | MultiplayerClientUserUpdate
  | MultiplayerClientUsersInRoom
  | MultiplayerClientUserUpdate
  | MultiplayerClientReload
  | MultiplayerClientRefreshJwt;

export type ClientMultiplayerMessage =
  | ClientMultiplayerInit
  | ClientMultiplayerMouseMove
  | ClientMultiplayerSelection
  | ClientMultiplayerSheet
  | ClientMultiplayerCellEdit
  | ClientMultiplayerViewport
  | ClientMultiplayerCodeRunning
  | ClientMultiplayerFollow
  | ClientMultiplayerRefreshJwt
  | ClientMultiplayerOnline
  | ClientMultiplayerOffline;
