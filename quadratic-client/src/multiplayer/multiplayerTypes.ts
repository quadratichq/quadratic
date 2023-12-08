import { Coordinate } from '@/gridGL/types/size';
import { Rectangle } from 'pixi.js';

export interface CellEdit {
  active: boolean;
  text: string;
  cursor: number;
  code_editor: boolean;
}

export interface MultiplayerUserServer {
  session_id: string;
  file_id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  email: string;
  image: string;
  sheet_id: string;
  cell_edit: CellEdit;
  visible: boolean;
  selection?: string;
  x?: number;
  y?: number;
  viewport: string;
}

// extended by the client
export interface MultiplayerUser extends MultiplayerUserServer {
  color: number;
  index: number;
  parsedSelection?: { cursor: Coordinate; rectangle: Rectangle };
}

export interface ReceiveRoom {
  type: 'UsersInRoom';
  users: MultiplayerUser[];
}

export interface MessageUserUpdate {
  type: 'UserUpdate';
  session_id: string;
  file_id: string;
  update: {
    cell_edit?: CellEdit;
    selection?: string;
    sheet_id?: string;
    x?: number;
    y?: number;
    visible?: boolean;
    viewport?: string;
  };
}

export interface SendEnterRoom extends MultiplayerUserServer {
  type: 'EnterRoom';
}

export interface MessageTransaction {
  type: 'Transaction';
  session_id: string;
  file_id: string;
  operations: string;
}

export interface Heartbeat {
  type: 'Heartbeat';
  session_id: string;
  file_id: string;
}

export interface ReceiveEmpty {
  type: 'Empty';
}

export type ReceiveMessages = ReceiveRoom | MessageUserUpdate | MessageTransaction | ReceiveEmpty;
