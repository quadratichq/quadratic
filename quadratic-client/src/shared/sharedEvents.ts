import EventEmitter from 'eventemitter3';

interface EventTypes {
  changeThemeAccentColor: (hexColorCode: number) => void;
}

export const sharedEvents = new EventEmitter<EventTypes>();
