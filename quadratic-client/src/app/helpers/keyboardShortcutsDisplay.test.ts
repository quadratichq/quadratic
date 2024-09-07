import { Action } from '@/app/actions/actions';
import { keyboardShortcutEnumToDisplay } from '@/app/helpers/keyboardShortcutsDisplay';
import { KeyboardSymbols } from '@/app/helpers/keyboardSymbols';
import { defaultShortcuts } from '@/app/keyboard/defaults';
import { Keys, MacModifiers, WindowsModifiers } from '@/app/keyboard/keys';
import * as isMacModule from '@/shared/utils/isMac';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/shared/utils/isMac');

describe('keyboardShortcutEnumToDisplay', () => {
  const mockAction = Action.ZoomIn;

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should return correct display for Mac shortcuts', () => {
    vi.spyOn(isMacModule, 'isMac', 'get').mockReturnValue(true);
    defaultShortcuts[mockAction] = {
      mac: [[MacModifiers.Cmd, Keys.Plus]],
      windows: [[WindowsModifiers.Ctrl, Keys.Plus]],
    };

    const result = keyboardShortcutEnumToDisplay(mockAction);
    expect(result).toBe(`${KeyboardSymbols.Command}+`);
  });

  it('should return correct display for Windows shortcuts', () => {
    vi.spyOn(isMacModule, 'isMac', 'get').mockReturnValue(false);
    defaultShortcuts[mockAction] = {
      mac: [[MacModifiers.Cmd, Keys.Plus]],
      windows: [[WindowsModifiers.Ctrl, Keys.Plus]],
    };

    const result = keyboardShortcutEnumToDisplay(mockAction);
    expect(result).toBe(`${KeyboardSymbols.Control}+`);
  });

  it('should handle multiple keys in a shortcut', () => {
    vi.spyOn(isMacModule, 'isMac', 'get').mockReturnValue(true);
    defaultShortcuts[mockAction] = {
      mac: [[MacModifiers.Cmd, MacModifiers.Shift, Keys.A]],
      windows: [[WindowsModifiers.Ctrl, WindowsModifiers.Shift, Keys.A]],
    };

    const result = keyboardShortcutEnumToDisplay(mockAction);
    expect(result).toBe(`${KeyboardSymbols.Command}${KeyboardSymbols.Shift}A`);
  });

  it('should handle special keys correctly', () => {
    vi.spyOn(isMacModule, 'isMac', 'get').mockReturnValue(true);
    defaultShortcuts[mockAction] = {
      mac: [[MacModifiers.Cmd, Keys.Enter, Keys.ArrowUp]],
      windows: [[WindowsModifiers.Ctrl, Keys.Enter, Keys.ArrowUp]],
    };

    const result = keyboardShortcutEnumToDisplay(mockAction);
    expect(result).toBe(`${KeyboardSymbols.Command}${KeyboardSymbols.Enter}${KeyboardSymbols.ArrowUp}`);
  });

  it('should handle all modifier keys', () => {
    vi.spyOn(isMacModule, 'isMac', 'get').mockReturnValue(true);
    defaultShortcuts[mockAction] = {
      mac: [[MacModifiers.Cmd, MacModifiers.Ctrl, MacModifiers.Alt, MacModifiers.Shift]],
      windows: [[WindowsModifiers.Ctrl, WindowsModifiers.Alt, WindowsModifiers.Shift]],
    };

    const result = keyboardShortcutEnumToDisplay(mockAction);
    expect(result).toBe(
      `${KeyboardSymbols.Command}${KeyboardSymbols.Control}${KeyboardSymbols.Alt}${KeyboardSymbols.Shift}`
    );
  });

  it('should handle regular keys correctly', () => {
    vi.spyOn(isMacModule, 'isMac', 'get').mockReturnValue(true);
    defaultShortcuts[mockAction] = {
      mac: [[Keys.A, Keys.B, Keys.C]],
      windows: [[Keys.A, Keys.B, Keys.C]],
    };

    const result = keyboardShortcutEnumToDisplay(mockAction);
    expect(result).toBe('ABC');
  });

  it('should handle empty shortcuts', () => {
    vi.spyOn(isMacModule, 'isMac', 'get').mockReturnValue(true);
    defaultShortcuts[mockAction] = {
      mac: [[]],
      windows: [[]],
    };

    const result = keyboardShortcutEnumToDisplay(mockAction);
    expect(result).toBe('');
  });

  it('should handle platform-specific shortcuts correctly', () => {
    vi.spyOn(isMacModule, 'isMac', 'get').mockReturnValue(true);
    defaultShortcuts[mockAction] = {
      mac: [[MacModifiers.Cmd, Keys.S]],
      windows: [[WindowsModifiers.Ctrl, Keys.S]],
    };
    let result = keyboardShortcutEnumToDisplay(mockAction);
    expect(result).toBe(`${KeyboardSymbols.Command}S`);

    vi.spyOn(isMacModule, 'isMac', 'get').mockReturnValue(false);
    result = keyboardShortcutEnumToDisplay(mockAction);
    expect(result).toBe(`${KeyboardSymbols.Control}S`);
  });
});
