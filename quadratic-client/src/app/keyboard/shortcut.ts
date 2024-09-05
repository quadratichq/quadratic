import { Action } from '../actions/actions';
import { Keys, MacModifiers, WindowsModifiers } from './keys';

type MacShortcut = (MacModifiers | Keys)[];
type WindowsShortcut = (WindowsModifiers | Keys)[];

export type Shortcut = MacShortcut | WindowsShortcut;

export type ActionShortcut = {
  [key in Action]: {
    mac: MacShortcut[];
    windows: WindowsShortcut[];
  };
};
