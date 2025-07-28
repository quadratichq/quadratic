import type { Rgba } from '@/app/quadratic-core-types';
import { colors } from '@/app/theme/colors';
import { captureException } from '@sentry/react';
import Color from 'color';
import type { ColorResult } from 'react-color';

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
    console.error('Error converting color string to tint', e);
    captureException(e, { data: color });
    return Color('gray').rgbNumber();
  }
}

export function convertTintToString(color: number): string {
  try {
    return Color(color).rgb().toString();
  } catch (e: any) {
    console.error('Error converting color tint to string', e);
    captureException(e, { data: color });
    return 'gray';
  }
}

export function convertTintToHex(color: number): string {
  try {
    return Color(color).hex();
  } catch (e: any) {
    console.error('Error converting color tint to hex', e);
    captureException(e, { data: color });
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
    console.error('Error converting color string to hex', e);
    captureException(e, { data: color });
    return Color('gray').hex();
  }
}

export function convertRgbaToTint(rgba: Rgba): { tint: number; alpha: number } {
  const rgb = { r: rgba.red, g: rgba.green, b: rgba.blue };
  return { tint: Color(rgb).rgbNumber(), alpha: rgba.alpha };
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
