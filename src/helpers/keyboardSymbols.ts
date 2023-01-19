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
