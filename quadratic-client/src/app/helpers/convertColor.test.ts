import {
  convertColorStringToHex,
  convertColorStringToTint,
  convertReactColorToString,
  convertRgbaToTint,
  convertTintToArray,
  convertTintToHex,
  convertTintToString,
} from '@/app/helpers/convertColor';
import { colors } from '@/app/theme/colors';
import type { ColorResult } from '@/app/ui/components/ColorPicker';
import { captureException } from '@sentry/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@sentry/react');

describe('Color Conversion Functions', () => {
  it('should convert ReactColor to string', () => {
    const color: ColorResult = {
      rgb: { r: 255, g: 0, b: 0, a: 1 },
      hex: '#FF0000',
      hsl: { h: 0, s: 100, l: 50, a: 1 },
    };
    expect(convertReactColorToString(color)).toBe('rgb(255, 0, 0)');
  });

  it('should convert color string to tint', () => {
    expect(convertColorStringToTint('red')).toBe(0xff0000);
  });

  it('should return gridBackground for "blank"', () => {
    expect(convertColorStringToTint('blank')).toBe(colors.gridBackground);
  });

  it('should convert tint to string', () => {
    expect(convertTintToString(0xff0000)).toBe('rgb(255, 0, 0)');
  });

  it('should convert tint to hex', () => {
    expect(convertTintToHex(0xff0000)).toBe('#FF0000');
  });

  it('should convert tint to array', () => {
    expect(convertTintToArray(0xff0000)).toEqual([1, 0, 0, 1]);
  });

  it('should handle small tint values', () => {
    expect(convertTintToArray(0x000001)).toEqual([0, 0, 1 / 255, 1]);
  });

  it('should convert color string to hex', () => {
    expect(convertColorStringToHex('red')).toBe('#FF0000');
  });

  it('should handle "blank" and return gridBackground as hex', () => {
    const expectedHex = convertTintToHex(colors.gridBackground);
    expect(convertColorStringToHex('blank')).toBe(expectedHex);
  });

  it('should handle errors and return default color for convertColorStringToHex', () => {
    console.error = vi.fn();
    expect(convertColorStringToHex('invalid')).toBe('#808080');
    expect(console.error).toHaveBeenCalled();
    expect(captureException).toHaveBeenCalled();
  });

  it('should convert RGBA to tint', () => {
    expect(convertRgbaToTint({ red: 255, green: 0, blue: 0, alpha: 1 })).toEqual({ tint: 0xff0000, alpha: 1 });
  });
});
