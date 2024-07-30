import { Action, defaultShortcuts } from '@/app/keyboard';
import { isMac } from '@/shared/utils/isMac';

/**
 * Checks if a keyboard event should trigger a specific action.
 * @param {keyof typeof defaultShortcuts} action - The action to check
 * @param {KeyboardEvent | React.KeyboardEvent<Element>} event - The keyboard event
 * @returns {boolean} - Whether the keyboard event should trigger the action
 */
export const matchShortcut = (action: Action, event: KeyboardEvent | React.KeyboardEvent<Element>): boolean => {
  const shortcuts = defaultShortcuts.find((shortcut) => shortcut.action === action)?.shortcuts;
  if (!shortcuts) {
    return false;
  }
  const platformShortcuts = isMac ? shortcuts.mac : shortcuts.windows;
  return platformShortcuts.some((shortcut) => {
    const parsedShortcut = parseCombination(shortcut);
    return (
      parsedShortcut.metaKey === event.metaKey &&
      parsedShortcut.ctrlKey === event.ctrlKey &&
      parsedShortcut.altKey === event.altKey &&
      parsedShortcut.shiftKey === event.shiftKey &&
      parsedShortcut.key === event.key.toLowerCase()
    );
  });
};

/**
 * Object representing a keyboard shortcut.
 */
type ParsedShortcut = { metaKey: boolean; ctrlKey: boolean; altKey: boolean; shiftKey: boolean; key?: string };

/**
 * Parses a key combination string into an object representation.
 * @param {string} combination - The key combination string (e.g., "Ctrl+Shift+A")
 * @returns {Object} - An object representing the key combination
 */
export const parseCombination = (combination: string): ParsedShortcut => {
  const keys = combination
    .toLowerCase()
    .split('+')
    .map((key) => key.trim());
  const result: ParsedShortcut = {
    metaKey: false,
    ctrlKey: false,
    altKey: false,
    shiftKey: false,
    key: undefined,
  };
  keys.forEach((key) => {
    switch (key) {
      case 'cmd':
      case 'win':
        result.metaKey = true;
        break;
      case 'ctrl':
        result.ctrlKey = true;
        break;
      case 'alt':
        result.altKey = true;
        break;
      case 'shift':
        result.shiftKey = true;
        break;
      case 'space':
        result.key = ' ';
        break;
      default:
        result.key = key;
        break;
    }
  });

  return result;
};
