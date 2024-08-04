import EventEmitter from 'eventemitter3';

interface EventTypes {
  status: (opened: boolean, content?: string) => void;

  replaceText: (text: string, highlight: boolean) => void;
}

export const inlineEditorEvents = new EventEmitter<EventTypes>();
