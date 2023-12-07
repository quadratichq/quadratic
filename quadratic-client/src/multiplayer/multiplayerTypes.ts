export interface ReceiveRoom {
  type: 'UsersInRoom';
  users: {
    session_id: string;
    user_id: string;
    first_name: string;
    last_name: string;
    image: string;
    sheet_id: string;
    selection: string;
  }[];
}

export interface MessageUserUpdate {
  type: 'UserUpdate';
  session_id: string;
  file_id: string;
  update: {
    selection?: string;
    sheet_id?: string;
    x?: number | null;
    y?: number | null;
    visible?: boolean;
  };
}

export interface SendEnterRoom {
  type: 'EnterRoom';
  session_id: string;
  user_id: string;
  file_id: string;
  sheet_id: string;
  selection: string;
  first_name: string;
  last_name: string;
  image: string;
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
