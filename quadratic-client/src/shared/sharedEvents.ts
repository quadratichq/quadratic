import EventEmitter from 'eventemitter3';

interface EventTypes {
  changeThemeAccentColor: () => void;
}

export const sharedEvents = new EventEmitter<EventTypes>();
