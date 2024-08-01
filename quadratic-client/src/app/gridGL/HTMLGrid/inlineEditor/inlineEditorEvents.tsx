import EventEmitter from 'eventemitter3';

interface EventTypes {
  status: (opened: boolean, content?: string) => void;
}

export const inlineEditorEvents = new EventEmitter<EventTypes>();
