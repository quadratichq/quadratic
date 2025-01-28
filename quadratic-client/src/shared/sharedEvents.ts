import EventEmitter from 'eventemitter3';

interface EventTypes {
  changeThemeAccentColor: () => void;
  gridLinesDirty: () => void;
}

export const sharedEvents = new EventEmitter<EventTypes>();
