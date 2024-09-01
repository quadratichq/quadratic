import * as Sentry from '@sentry/react';
import Color from 'color';
import { ColorResult } from 'react-color';
import { colors } from '../theme/colors';
import { Rgba } from '../quadratic-core-types';

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
    Sentry.captureException(e, { data: color });
    return Color('gray').rgbNumber(); // Consistent use of 'gray'
  }
}

export function convertTintToString(color: number): string {
  try {
    return Color(color).rgb().toString();
  } catch (e: any) {
    console.error('Error converting color tint to string', e);
    Sentry.captureException(e, { data: color });
    return 'gray'; // Already using 'gray'
  }
}

export function convertTintToHex(color: number): string {
  try {
    return Color(color).hex();
  } catch (e: any) {
    console.error('Error converting color tint to hex', e);
    Sentry.captureException(e, { data: color });
    return Color('gray').hex(); // Consistent use of 'gray'
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
    Sentry.captureException(e, { data: color });
    return Color('gray').hex(); // Consistent use of 'gray'
  }
}

export function convertRgbaToTint(rgba: Rgba): { tint: number; alpha: number } {
  const rgb = { r: rgba.red, g: rgba.green, b: rgba.blue };
  return { tint: Color(rgb).rgbNumber(), alpha: rgba.alpha };
}
