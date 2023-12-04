export interface MessageMouseMove {
  type: 'MouseMove';
  user_id: string;
  file_id: string;
  x?: number | null;
  y?: number | null;
}

export interface ReceiveEnterRoom {
  type: 'Room';
  room: {
    users: Record<
      string,
      {
        user_id: string;
        first_name: string;
        last_name: string;
        image: string;
      }
    >;
  };
}

export interface MessageChangeSelection {
  type: 'ChangeSelection';
  user_id: string;
  file_id: string;
  selection: string;
}

export interface SendEnterRoom {
  type: 'EnterRoom';
  user_id: string;
  file_id: string;
  first_name: string;
  last_name: string;
  image: string;
}

export type ReceiveMessages = MessageMouseMove | ReceiveEnterRoom | MessageChangeSelection;
