import Color from 'color';
import { ColorResult } from 'react-color';

export function convertReactColorToString(color: ColorResult): string {
  const rgb = color.rgb;
  return Color({ r: rgb.r, g: rgb.g, b: rgb.b }).rgb().toString();
}

export function convertColorStringToTint(color: string): number {
  return Color(color).rgbNumber();
}

export function convertTintToString(color: number): string {
  return Color(color).rgb().toString();
}

export function convertTintToArray(color: number): [number, number, number, number] {
  let s = color.toString(16);
  while (s.length < 6) {
    s = '0' + s;
  }
  return [
    parseInt(s.substring(0, 2), 16) / 256,
    parseInt(s.substring(2, 4), 16) / 256,
    parseInt(s.substring(4, 6), 16) / 256,
    1,
  ];
}
