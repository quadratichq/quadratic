import EventEmitter from 'eventemitter3';

export interface EventTypes {
  undoRedo: {
    undo: boolean;
    redo: boolean;
  };
}

export const events = new EventEmitter<EventTypes>();
