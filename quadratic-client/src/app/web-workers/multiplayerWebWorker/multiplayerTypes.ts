import type { JsSelection } from '@/app/quadratic-core/quadratic_core';
import type { SheetPosTS } from '@/app/shared/types/size';

// todo: this should be replaced with automatic types created by export_types.rs

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
  // AI agent fields
  is_ai_agent?: boolean;
  agent_persona?: string;
  agent_color?: string;
}

// extended by the client
export interface MultiplayerUser extends MultiplayerUserServer {
  color: number;
  index: number;
  colorString: string;
  parsedCodeRunning: SheetPosTS[];
  parsedSelection?: JsSelection;
}

export interface ReceiveRoom {
  type: 'UsersInRoom';
  users: MultiplayerUser[];
  version: string;
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
  type: 'Transaction' | 'BinaryTransaction';
  id: string;
  file_id: string;
  operations: string | Buffer;
  sequence_num: number;
}

export interface ReceiveTransactionAck {
  type: 'TransactionAck';
  id: string;
  file_id: string;
  sequence_num: number;
}

export interface SendTransaction {
  type: 'Transaction';
  id: string;
  session_id: string;
  file_id: string;
  operations: Uint8Array<ArrayBufferLike>;
}

export type SendBinaryTransaction = Uint8Array<ArrayBufferLike>;

export interface SendGetTransactions {
  type: 'GetTransactions';
  session_id: string;
  file_id: string;
  min_sequence_num: number;
}

export interface SendGetBinaryTransactions {
  type: 'GetBinaryTransactions';
  session_id: string;
  file_id: string;
  min_sequence_num: number;
}

export interface ReceiveTransactions {
  type: 'Transactions' | 'BinaryTransactions';
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
  | ReceiveTransactionAck
  | ReceiveEmpty
  | ReceiveTransactions
  | ReceiveEnterRoom
  | ReceiveError
  | ReceiveCurrentTransaction;

export type MultiplayerServerMessage =
  | SendTransaction
  | SendEnterRoom
  | SendGetTransactions
  | SendGetBinaryTransactions;

export type MultiplayerServerBinaryMessage = SendBinaryTransaction;
