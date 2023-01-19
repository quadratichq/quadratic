import { isMac } from '../utils/isMac';

export interface IKeyboardSymbols {
  Shift: string;
  ArrowUp: string;
  ArrowRight: string;
  ArrowDown: string;
  ArrowLeft: string;
  Enter: string;
  Backspace: string;
  Delete: string;
  Escape: string;
  Command: string;
  Control: string;
  Alt: string;
}

// Borrowed in part from
// https://github.com/ueberdosis/keyboard-symbol#readme
export const KeyboardSymbols: IKeyboardSymbols = {
  Shift: '⇧',
  ArrowUp: '↑',
  ArrowRight: '→',
  ArrowDown: '↓',
  ArrowLeft: '←',
  Enter: '↵',
  Backspace: '⌫',
  Delete: '⌦',
  Escape: '⎋',
  Command: isMac ? '⌘' : 'Ctrl',
  Control: isMac ? '⌃' : 'Ctrl',
  Alt: isMac ? '⌥' : 'Alt',
};

/*
export const getKeyboardModifierFromEvent = (event: KeyboardEvent): String => {
  if (event.altKey) {
    return KEYBOARD_MODIFIERS[KeyboardModifier.ALT];
  } else if (event.metaKey || event.ctrlKey) {
    return KEYBOARD_MODIFIERS[KeyboardModifier.CTRL]
  } else if (event.shiftKey) {
    return KEYBOARD_MODIFIERS[KeyboardModifier.SHIFT]
  }else {
    return "";
  }
}
*/
