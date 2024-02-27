import EventEmitter from 'eventemitter3';

export interface EventTypes {
  undoRedo: {
    undo: boolean;
    redo: boolean;
  };

  addSheet: {
    sheetId: string;
    name: string;
    order: string;
  };
}

export const events = new EventEmitter<EventTypes>();
