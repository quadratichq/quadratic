import { defaultShortcuts } from '@/app/theme/shortcuts.js';
import { isMac } from '@/shared/utils/isMac.js';

/**
 * Checks if a keyboard event should trigger a specific action.
 * @param {keyof typeof defaultShortcuts} action - The action to check
 * @param {KeyboardEvent | React.KeyboardEvent<Element>} event - The keyboard event
 * @returns {boolean} - Whether the keyboard event should trigger the action
 */
export const matchShortcut = (
  action: keyof typeof defaultShortcuts,
  event: KeyboardEvent | React.KeyboardEvent<Element>
): boolean => {
  const combinations = defaultShortcuts[action];
  return combinations.some((combination) => {
    const parsedCombination = parseCombination(combination);
    return (
      parsedCombination.meta === event.metaKey &&
      parsedCombination.ctrl === event.ctrlKey &&
      parsedCombination.alt === event.altKey &&
      parsedCombination.shift === event.shiftKey &&
      parsedCombination.key === event.key.toLowerCase()
    );
  });
};

/**
 * Object representing a keyboard shortcut.
 */
type ParsedShortcut = { meta: boolean; ctrl: boolean; alt: boolean; shift: boolean; key?: string };

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
    meta: false,
    ctrl: false,
    alt: false,
    shift: false,
    key: undefined,
  };
  keys.forEach((key) => {
    switch (key) {
      case 'cmd':
        result.meta = isMac;
        result.ctrl = !isMac;
        break;
      case 'ctrl':
        result.ctrl = true;
        break;
      case 'alt':
        result.alt = true;
        break;
      case 'shift':
        result.shift = true;
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
