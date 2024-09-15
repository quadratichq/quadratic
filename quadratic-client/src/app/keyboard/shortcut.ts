import { Action } from '@/app/actions/actions';
import { Keys, MacModifiers, WindowsModifiers } from '@/app/keyboard/keys';

type MacShortcut = (MacModifiers | Keys)[];
type WindowsShortcut = (WindowsModifiers | Keys)[];

export type Shortcut = MacShortcut | WindowsShortcut;

export type ActionShortcut = Partial<{
  [key in Action]: {
    mac: MacShortcut[];
    windows: WindowsShortcut[];
  };
}>;
