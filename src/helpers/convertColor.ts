import { ColorResult } from 'react-color';
import Color from 'color';

export function convertReactColorToString(color: ColorResult): string {
  const rgb = color.rgb;
  return Color({ r: rgb.r, g: rgb.g, b: rgb.b }).rgb().toString()
}

export function convertColorStringToTint(color: string): number {
  return Color(color).rgbNumber();
}