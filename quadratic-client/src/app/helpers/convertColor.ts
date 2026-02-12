import type { Rgba } from '@/app/quadratic-core-types';
import { colors } from '@/app/theme/colors';
import type { ColorResult } from '@/app/ui/components/ColorPicker';
import { sendAnalyticsError } from '@/shared/utils/error';
import Color from 'color';

const convertColorSendAnalyticsError = (from: string, error: Error | unknown) => {
  sendAnalyticsError('convertColor', from, error);
};

export function convertReactColorToString(color: ColorResult): string {
  const rgb = color.rgb;
  return Color({ r: rgb.r, g: rgb.g, b: rgb.b }).rgb().toString();
}

export function convertColorStringToTint(color: string): number {
  if (color === 'blank') {
    return colors.gridBackground;
  }
  try {
    return Color(color).rgbNumber();
  } catch (e: any) {
    convertColorSendAnalyticsError('convertColorStringToTint', e);
    return Color('gray').rgbNumber();
  }
}

export function convertTintToString(color: number): string {
  try {
    return Color(color).rgb().toString();
  } catch (e: any) {
    convertColorSendAnalyticsError('convertTintToString', e);
    return 'gray';
  }
}

export function convertTintToHex(color: number): string {
  try {
    return Color(color).hex();
  } catch (e: any) {
    convertColorSendAnalyticsError('convertTintToHex', e);
    return Color('gray').hex();
  }
}

export function convertTintToArray(color: number): [number, number, number, number] {
  let s = color.toString(16);
  while (s.length < 6) {
    s = '0' + s;
  }
  return [
    parseInt(s.substring(0, 2), 16) / 255,
    parseInt(s.substring(2, 4), 16) / 255,
    parseInt(s.substring(4, 6), 16) / 255,
    1,
  ];
}

export function convertColorStringToHex(color: string): string {
  if (color === 'blank') {
    return convertTintToHex(colors.gridBackground);
  }
  try {
    return Color(color).hex();
  } catch (e: any) {
    convertColorSendAnalyticsError('convertColorStringToHex', e);
    return Color('gray').hex();
  }
}

export function convertRgbaToTint(rgba: Rgba): { tint: number; alpha: number } {
  const rgb = { r: rgba.red, g: rgba.green, b: rgba.blue };
  return { tint: Color(rgb).rgbNumber(), alpha: rgba.alpha };
}

// Color picker utility functions

/** Convert hex color string to RGB object */
export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  try {
    const color = Color(hex);
    const rgb = color.rgb().object();
    return {
      r: Math.round(rgb.r),
      g: Math.round(rgb.g),
      b: Math.round(rgb.b),
    };
  } catch {
    return { r: 0, g: 0, b: 0 };
  }
}

/** Convert hex color string to HSL object */
export function hexToHsl(hex: string): { h: number; s: number; l: number } {
  try {
    const color = Color(hex);
    const hsl = color.hsl().object();
    return {
      h: Math.round(hsl.h || 0),
      s: Math.round(hsl.s || 0),
      l: Math.round(hsl.l || 0),
    };
  } catch {
    return { h: 0, s: 100, l: 50 };
  }
}

/** Convert hex color string to HSV object (saturation and value as 0-1) */
export function hexToHsv(hex: string): { h: number; s: number; v: number } {
  try {
    const color = Color(hex);
    const hsv = color.hsv().object();
    return {
      h: hsv.h || 0,
      s: (hsv.s || 0) / 100,
      v: (hsv.v || 0) / 100,
    };
  } catch {
    return { h: 0, s: 1, v: 1 };
  }
}

/** Convert RGB values to hex string */
export function rgbToHex(r: number, g: number, b: number): string {
  try {
    return Color.rgb(r, g, b).hex();
  } catch {
    return '#000000';
  }
}

/** Convert HSL values to hex string */
export function hslToHex(h: number, s: number, l: number): string {
  try {
    return Color.hsl(h, s, l).hex();
  } catch {
    return '#000000';
  }
}

/** Convert HSV values to hex string (saturation and value as 0-1) */
export function hsvToHex(h: number, s: number, v: number): string {
  try {
    return Color.hsv(h, s * 100, v * 100).hex();
  } catch {
    return '#000000';
  }
}

/** Validate if a string is a valid hex color */
export function isValidHex(hex: string): boolean {
  return /^#?([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(hex);
}

/** Normalize a color string to lowercase hex format */
export function normalizeColor(color: string): string | null {
  try {
    const c = Color(color);
    return c.hex().toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Given the name of a CSS variable that maps to an HSL string, return the tint
 * we can use in pixi.
 * @param cssVariableName - CSS var without the `--` prefix
 * @param options - Optional options object
 * @param options.luminosity - If provided, will multiply the luminosity by this number
 */
export function getCSSVariableTint(cssVariableName: string, options?: { luminosity?: number }): number {
  if (cssVariableName.startsWith('--')) {
    console.warn(
      '`getCSSVariableTint` expects a CSS variable name without the `--` prefix. Are you sure you meant: `%s`',
      cssVariableName
    );
  }

  const hslColorString = getComputedStyle(document.documentElement).getPropertyValue(`--${cssVariableName}`).trim();
  const numbers = hslColorString.split(' ').map(parseFloat);
  if (options?.luminosity) {
    numbers[2] *= options.luminosity;
  }
  const parsed = Color.hsl(...numbers);
  const out = parsed.rgbNumber();
  return out;
}

/**
 * Given the name of a CSS variable that maps to an HSL string, return the tint
 * we can use in pixi.
 * @param cssVariableName - CSS var without the `--` prefix
 * @param luminosity - If provided, will multiply the luminosity by this number
 */
export function cssVariableWithLuminosity(cssVariableName: string, luminosity: number): string {
  if (cssVariableName.startsWith('--')) {
    console.warn(
      '`getCSSVariableTint` expects a CSS variable name without the `--` prefix. Are you sure you meant: `%s`',
      cssVariableName
    );
  }

  const hslColorString = getComputedStyle(document.documentElement).getPropertyValue(`--${cssVariableName}`).trim();
  const numbers = hslColorString.split(' ').map(parseFloat);
  numbers[2] *= luminosity;
  const parsed = Color.hsl(...numbers);
  return parsed.rgb().toString();
}
