import type { SheetPosTS } from '@/app/gridGL/types/size';
import type { JsSelection } from '@/app/quadratic-rust-client/quadratic_rust_client';

export interface CellEdit {
  active: boolean;
  text: string;
  cursor: number;
  code_editor: boolean;
  inline_code_editor: boolean;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikeThrough?: boolean;
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
  follow?: string;
}

// extended by the client
export interface MultiplayerUser extends MultiplayerUserServer {
  color: number;
  index: number;
  colorString: string;
  parsedCodeRunning: SheetPosTS[];
  parsedSelection?: JsSelection;
}

export interface Version {
  recommendedVersion: number;
  requiredVersion: number;
}

export interface ReceiveRoom {
  type: 'UsersInRoom';
  users: MultiplayerUser[];
  min_version: Version;
}

export interface UserUpdate {
  cell_edit?: CellEdit;
  selection?: string;
  sheet_id?: string;
  x?: number;
  y?: number;
  visible?: boolean;
  viewport?: string;
  code_running?: string;
  follow?: string;
}

export interface MessageUserUpdate {
  type: 'UserUpdate';
  session_id: string;
  file_id: string;
  update: UserUpdate;
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
  operations: string | Buffer;
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
  min_sequence_num: number;
}

export interface ReceiveTransactions {
  type: 'Transactions';
  transactions: ReceiveTransaction[];
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
  error: string | Record<string, string[]>;
  error_level: string;
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

export type MultiplayerServerMessage = SendTransaction | SendEnterRoom | SendGetTransactions;
