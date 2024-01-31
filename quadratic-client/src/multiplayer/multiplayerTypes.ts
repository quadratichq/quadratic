import { Coordinate, SheetPos } from '@/gridGL/types/size';
import { Rectangle } from 'pixi.js';

export interface CellEdit {
  active: boolean;
  text: string;
  cursor: number;
  code_editor: boolean;
  bold?: boolean;
  italic?: boolean;
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
  code_running: string;
}

// extended by the client
export interface MultiplayerUser extends MultiplayerUserServer {
  color: number;
  index: number;
  colorString: string;
  parsedCodeRunning: SheetPos[];
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
    code_running?: string;
  };
}

export interface SendEnterRoom extends MultiplayerUserServer {
  type: 'EnterRoom';
}

export interface ReceiveEnterRoom {
  type: 'EnterRoom';
  file_id: string;
  sequence_num: number;
}

export interface Transaction {
  id: string;
  file_id: string;
  sequence_num: number;
  operations: string[];
}

export interface ReceiveTransaction {
  type: 'Transaction';
  id: string;
  file_id: string;
  operations: string;
  sequence_num: number;
}

export interface SendTransaction {
  type: 'Transaction';
  id: string;
  session_id: string;
  file_id: string;
  operations: string;
}

export interface SendGetTransactions {
  type: 'GetTransactions';
  session_id: string;
  file_id: string;
  min_sequence_num: bigint;
}

export interface ReceiveTransactions {
  type: 'Transactions';
  transactions: string;
}

export interface Heartbeat {
  type: 'Heartbeat';
  session_id: string;
  file_id: string;
}

export interface ReceiveEmpty {
  type: 'Empty';
}

export interface ReceiveCurrentTransaction {
  type: 'CurrentTransaction';
  sequence_num: number;
}

export interface ReceiveError {
  type: 'Error';
  error: string;
}

export type ReceiveMessages =
  | ReceiveRoom
  | MessageUserUpdate
  | ReceiveTransaction
  | ReceiveEmpty
  | ReceiveTransactions
  | ReceiveEnterRoom
  | ReceiveError
  | ReceiveCurrentTransaction;
