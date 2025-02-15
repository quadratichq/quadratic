import type { Action } from '@/app/actions/actions';
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

  // Define a uniform, consistent display order for the shortcut keys
  // The larger or more central modifiers tend to come last, like Command or Control.
  // So, for macOS for example, you would see:
  //   Redo  ⌘Z
  //   Undo ⇧⌘Z
  // Not:
  //   Redo  ⌘Z
  //   Undo ⌘⇧Z
  const orderMap = new Map(
    (isMac
      ? [MacModifiers.Ctrl, MacModifiers.Alt, MacModifiers.Shift, MacModifiers.Cmd]
      : [WindowsModifiers.Ctrl, WindowsModifiers.Alt, WindowsModifiers.Shift]
    ).map((key, index) => [key, index])
  );
  const orderedKeys = platformShortcuts[0]?.sort((a, b) => {
    const orderA = orderMap.get(a as MacModifiers | WindowsModifiers) ?? Infinity;
    const orderB = orderMap.get(b as MacModifiers | WindowsModifiers) ?? Infinity;
    return orderA - orderB;
  });

  orderedKeys?.forEach((key) => {
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
