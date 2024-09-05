import { Action } from '@/app/actions/actions';
import { matchShortcut, processShortcut } from '@/app/helpers/keyboardShortcuts';
import { defaultShortcuts } from '@/app/keyboard/defaults';
import { Keys, MacModifiers, WindowsModifiers } from '@/app/keyboard/keys';
import * as isMacModule from '@/shared/utils/isMac';
import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('shortcut utility functions', () => {
  describe('processShortcut', () => {
    it('should process a simple shortcut', () => {
      const result = processShortcut([MacModifiers.Cmd, Keys.A]);
      expect(result).toEqual({ metaKey: true, ctrlKey: false, altKey: false, shiftKey: false, key: 'A' });
    });

    it('should process a shortcut with multiple modifiers', () => {
      const result = processShortcut([MacModifiers.Cmd, MacModifiers.Shift, MacModifiers.Alt, Keys.B]);
      expect(result).toEqual({ metaKey: true, ctrlKey: false, altKey: true, shiftKey: true, key: 'B' });
    });

    it('should handle Windows modifiers', () => {
      const result = processShortcut([WindowsModifiers.Ctrl, WindowsModifiers.Alt, Keys.C]);
      expect(result).toEqual({ metaKey: false, ctrlKey: true, altKey: true, shiftKey: false, key: 'C' });
    });

    it('should handle special keys', () => {
      const result = processShortcut([MacModifiers.Cmd, Keys.Enter]);
      expect(result).toEqual({ metaKey: true, ctrlKey: false, altKey: false, shiftKey: false, key: 'Enter' });
    });

    it('should handle shortcuts with only modifiers', () => {
      const result = processShortcut([MacModifiers.Cmd, MacModifiers.Shift]);
      expect(result).toEqual({ metaKey: true, ctrlKey: false, altKey: false, shiftKey: true, key: undefined });
    });
  });

  describe('matchShortcut', () => {
    beforeEach(() => {
      vi.spyOn(isMacModule, 'isMac', 'get').mockReturnValue(true);
    });

    it('should match a simple shortcut', () => {
      const event = new KeyboardEvent('keydown', { key: 'p', metaKey: true });
      expect(matchShortcut(Action.ShowCommandPalette, event)).toBe(true);
    });

    it('should match a shortcut with multiple keys', () => {
      const event = new KeyboardEvent('keydown', { key: 'z', metaKey: true, shiftKey: true });
      expect(matchShortcut(Action.Redo, event)).toBe(true);
    });

    it('should not match when a required key is missing', () => {
      const event = new KeyboardEvent('keydown', { key: 'p', ctrlKey: true }); // Missing meta key
      expect(matchShortcut(Action.ShowCommandPalette, event)).toBe(false);
    });

    it('should match case-insensitively', () => {
      const event = new KeyboardEvent('keydown', { key: 'P', metaKey: true });
      expect(matchShortcut(Action.ShowCommandPalette, event)).toBe(true);
    });

    it('should handle special keys like Space', () => {
      const event = new KeyboardEvent('keydown', { key: ' ' });
      expect(matchShortcut(Action.GridPanMode, event)).toBe(true);
    });

    it('should match when multiple shortcut combinations are defined', () => {
      const event1 = new KeyboardEvent('keydown', { key: 'z', metaKey: true, shiftKey: true });
      const event2 = new KeyboardEvent('keydown', { key: 'y', metaKey: true });
      expect(matchShortcut(Action.Redo, event1)).toBe(true);
      expect(matchShortcut(Action.Redo, event2)).toBe(true);
    });

    it('should not match when an extra modifier key is pressed', () => {
      const event = new KeyboardEvent('keydown', { key: 'p', metaKey: true, altKey: true });
      expect(matchShortcut(Action.ShowCommandPalette, event)).toBe(false);
    });
  });

  describe('integration tests', () => {
    it('should correctly match all default mac shortcuts', () => {
      Object.entries(defaultShortcuts).forEach(([action, shortcuts]) => {
        vi.spyOn(isMacModule, 'isMac', 'get').mockReturnValue(true);
        shortcuts.mac.forEach((shortcut) => {
          const { metaKey, ctrlKey, altKey, shiftKey, key } = processShortcut(shortcut);
          const event = new KeyboardEvent('keydown', {
            metaKey,
            ctrlKey,
            altKey,
            shiftKey,
            key,
          });
          expect(matchShortcut(action as Action, event)).toBe(true);
        });
      });
    });

    it('should correctly match all default windows shortcuts', () => {
      Object.entries(defaultShortcuts).forEach(([action, shortcuts]) => {
        vi.spyOn(isMacModule, 'isMac', 'get').mockReturnValue(false);
        shortcuts.windows.forEach((shortcut) => {
          const { metaKey, ctrlKey, altKey, shiftKey, key } = processShortcut(shortcut);
          const event = new KeyboardEvent('keydown', {
            metaKey,
            ctrlKey,
            altKey,
            shiftKey,
            key,
          });
          expect(matchShortcut(action as Action, event)).toBe(true);
        });
      });
    });

    it('should not match shortcuts with extra keys pressed', () => {
      const event = new KeyboardEvent('keydown', { key: 'p', metaKey: true, altKey: true }); // Extra Alt key
      expect(matchShortcut(Action.ShowCommandPalette, event)).toBe(false);
    });

    it('should handle platform-specific shortcuts correctly', () => {
      vi.spyOn(isMacModule, 'isMac', 'get').mockReturnValue(true);
      let event = new KeyboardEvent('keydown', { key: 's', metaKey: true });
      expect(matchShortcut(Action.Save, event)).toBe(true);

      vi.spyOn(isMacModule, 'isMac', 'get').mockReturnValue(false);
      event = new KeyboardEvent('keydown', { key: 's', ctrlKey: true });
      expect(matchShortcut(Action.Save, event)).toBe(true);
    });
  });
});
