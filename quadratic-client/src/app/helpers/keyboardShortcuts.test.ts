import { defaultShortcuts, ShortcutsSchema } from '@/app/keyboard';
import * as isMacModule from '@/shared/utils/isMac';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { matchShortcut, parseCombination } from './keyboardShortcuts';

describe('shortcut utility functions', () => {
  describe('validate shortcuts', () => {
    it('parse zod schema', () => {
      ShortcutsSchema.parse(defaultShortcuts);
    });
  });

  describe('parseCombination', () => {
    beforeEach(() => {
      vi.resetModules();
    });

    it('should parse a simple combination', () => {
      const result = parseCombination('Ctrl+A');
      expect(result).toEqual({ metaKey: false, ctrlKey: true, altKey: false, shiftKey: false, key: 'a' });
    });

    it('should parse a combination with multiple modifier keys', () => {
      const result = parseCombination('Ctrl+Shift+Alt+X');
      expect(result).toEqual({ metaKey: false, ctrlKey: true, altKey: true, shiftKey: true, key: 'x' });
    });

    it('should handle the Cmd key on Mac', () => {
      vi.spyOn(isMacModule, 'isMac', 'get').mockReturnValue(true);
      const result = parseCombination('Cmd+B');
      expect(result).toEqual({ metaKey: true, ctrlKey: false, altKey: false, shiftKey: false, key: 'b' });
    });

    it('should handle the Space key', () => {
      const result = parseCombination('Space');
      expect(result).toEqual({ metaKey: false, ctrlKey: false, altKey: false, shiftKey: false, key: ' ' });
    });

    it('should be case-insensitive', () => {
      const result = parseCombination('CTRL+shift+ALT+x');
      expect(result).toEqual({ metaKey: false, ctrlKey: true, altKey: true, shiftKey: true, key: 'x' });
    });

    it('should handle combinations with spaces', () => {
      const result = parseCombination('Ctrl + Shift + X');
      expect(result).toEqual({ metaKey: false, ctrlKey: true, altKey: false, shiftKey: true, key: 'x' });
    });
  });

  describe('matchShortcut', () => {
    beforeEach(() => {
      vi.spyOn(isMacModule, 'isMac', 'get').mockReturnValue(true);
    });

    it('should match a simple shortcut', () => {
      const event = new KeyboardEvent('keydown', { key: 'p', metaKey: true });
      expect(matchShortcut('show_command_palette', event)).toBe(true);
    });

    it('should match a shortcut with multiple keys', () => {
      const event = new KeyboardEvent('keydown', { key: 'z', metaKey: true, shiftKey: true });
      expect(matchShortcut('redo', event)).toBe(true);
    });

    it('should not match when a required key is missing', () => {
      const event = new KeyboardEvent('keydown', { key: 'p', ctrlKey: true }); // Missing meta key
      expect(matchShortcut('show_command_palette', event)).toBe(false);
    });

    it('should match case-insensitively', () => {
      const event = new KeyboardEvent('keydown', { key: 'P', metaKey: true });
      expect(matchShortcut('show_command_palette', event)).toBe(true);
    });

    it('should handle special keys like Space', () => {
      const event = new KeyboardEvent('keydown', { key: ' ' });
      expect(matchShortcut('grid_pan_mode', event)).toBe(true);
    });

    it('should match when multiple shortcut combinations are defined', () => {
      const event1 = new KeyboardEvent('keydown', { key: 'z', metaKey: true, shiftKey: true });
      const event2 = new KeyboardEvent('keydown', { key: 'y', metaKey: true });
      expect(matchShortcut('redo', event1)).toBe(true);
      expect(matchShortcut('redo', event2)).toBe(true);
    });
  });

  describe('integration tests', () => {
    it('should correctly match all default mac shortcuts', () => {
      defaultShortcuts.forEach(({ action, shortcuts }) => {
        vi.spyOn(isMacModule, 'isMac', 'get').mockReturnValue(true);
        shortcuts.mac.forEach((combination) => {
          const { metaKey, ctrlKey, altKey, shiftKey, key } = parseCombination(combination);
          const event = new KeyboardEvent('keydown', {
            metaKey,
            ctrlKey,
            altKey,
            shiftKey,
            key,
          });
          expect(matchShortcut(action, event)).toBe(true);
        });
      });
    });

    it('should correctly match all default windows shortcuts', () => {
      defaultShortcuts.forEach(({ action, shortcuts }) => {
        vi.spyOn(isMacModule, 'isMac', 'get').mockReturnValue(false);
        shortcuts.windows.forEach((combination) => {
          const { metaKey, ctrlKey, altKey, shiftKey, key } = parseCombination(combination);
          const event = new KeyboardEvent('keydown', {
            metaKey,
            ctrlKey,
            altKey,
            shiftKey,
            key,
          });
          expect(matchShortcut(action, event)).toBe(true);
        });
      });
    });

    it('should not match shortcuts with extra keys pressed', () => {
      const event = new KeyboardEvent('keydown', { key: 'p', metaKey: true, altKey: true }); // Extra Alt key
      expect(matchShortcut('show_command_palette', event)).toBe(false);
    });

    it('should handle platform-specific shortcuts correctly', () => {
      vi.spyOn(isMacModule, 'isMac', 'get').mockReturnValue(true);
      let event = new KeyboardEvent('keydown', { key: 's', metaKey: true });
      expect(matchShortcut('save', event)).toBe(true);

      vi.spyOn(isMacModule, 'isMac', 'get').mockReturnValue(false);
      event = new KeyboardEvent('keydown', { key: 's', ctrlKey: true });
      expect(matchShortcut('save', event)).toBe(true);
    });
  });
});
