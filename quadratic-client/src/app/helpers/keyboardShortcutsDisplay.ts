import { Action } from '@/app/actions/actions';
import { KeyboardSymbols } from '@/app/helpers/keyboardSymbols';
import { defaultShortcuts } from '@/app/keyboard/defaults';
import { Keys, MacModifiers, WindowsModifiers } from '@/app/keyboard/keys';
import { isMac } from '@/shared/utils/isMac';

export function keyboardShortcutEnumToDisplay(action: Action) {
  const platformShortcuts = isMac ? defaultShortcuts[action]?.mac : defaultShortcuts[action]?.windows;
  let display = '';

  if (!platformShortcuts) {
    return display;
  }

  platformShortcuts[0]?.forEach((key) => {
    switch (key) {
      case MacModifiers.Cmd:
        display += KeyboardSymbols.Command;
        break;
      case MacModifiers.Ctrl:
      case WindowsModifiers.Ctrl:
        display += KeyboardSymbols.Control;
        break;
      case MacModifiers.Alt:
      case WindowsModifiers.Alt:
        display += KeyboardSymbols.Alt;
        break;
      case MacModifiers.Shift:
      case WindowsModifiers.Shift:
        display += KeyboardSymbols.Shift;
        break;
      case Keys.Escape:
        display += KeyboardSymbols.Escape;
        break;
      case Keys.Enter:
        display += KeyboardSymbols.Enter;
        break;
      case Keys.Backspace:
        display += KeyboardSymbols.Backspace;
        break;
      case Keys.Delete:
        display += KeyboardSymbols.Delete;
        break;
      case Keys.ArrowUp:
        display += KeyboardSymbols.ArrowUp;
        break;
      case Keys.ArrowRight:
        display += KeyboardSymbols.ArrowRight;
        break;
      case Keys.ArrowDown:
        display += KeyboardSymbols.ArrowDown;
        break;
      case Keys.ArrowLeft:
        display += KeyboardSymbols.ArrowLeft;
        break;
      default:
        display += key;
        break;
    }
  });
  return display;
}
