import { Action } from '@/app/actions/actions';
import { defaultShortcuts } from '@/app/keyboard/defaults';
import { MacModifiers, WindowsModifiers } from '@/app/keyboard/keys';
import { Shortcut } from '@/app/keyboard/shortcut';
import { isMac } from '@/shared/utils/isMac';

/**
 * Checks if a keyboard event should trigger a specific action.
 * @param {Action} action - The action to check
 * @param {KeyboardEvent | React.KeyboardEvent<Element>} event - The keyboard event
 * @returns {boolean} Whether the keyboard event should trigger the action
 */
export const matchShortcut = (action: Action, event: KeyboardEvent | React.KeyboardEvent<Element>): boolean => {
  const shortcuts = isMac ? defaultShortcuts[action].mac : defaultShortcuts[action].windows;
  if (!shortcuts) {
    return false;
  }
  return shortcuts.some((shortcut) => {
    const eventKeys = processShortcut(shortcut);
    return (
      eventKeys.metaKey === event.metaKey &&
      eventKeys.ctrlKey === event.ctrlKey &&
      eventKeys.altKey === event.altKey &&
      eventKeys.shiftKey === event.shiftKey &&
      eventKeys.key?.toLowerCase() === event.key.toLowerCase()
    );
  });
};

type EventKeys = {
  metaKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
  key?: string;
};

/**
 * Processes a shortcut combination into an object representation.
 * @param {Shortcut} shortcut - The shortcut combination
 * @returns {EventKeys} - An object representing the keys to be matched against the event
 */
export const processShortcut = (shortcut: Shortcut): EventKeys => {
  const result: EventKeys = {
    metaKey: false,
    ctrlKey: false,
    altKey: false,
    shiftKey: false,
    key: undefined,
  };

  shortcut.forEach((key) => {
    switch (key) {
      case MacModifiers.Cmd:
      case WindowsModifiers.Win:
        result.metaKey = true;
        break;
      case MacModifiers.Ctrl:
      case WindowsModifiers.Ctrl:
        result.ctrlKey = true;
        break;
      case MacModifiers.Alt:
      case WindowsModifiers.Alt:
        result.altKey = true;
        break;
      case MacModifiers.Shift:
      case WindowsModifiers.Shift:
        result.shiftKey = true;
        break;
      default:
        result.key = key;
    }
  });

  return result;
};
