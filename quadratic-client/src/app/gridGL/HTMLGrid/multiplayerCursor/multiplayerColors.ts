import colors from 'tailwindcss/colors';

// Pull all the colors from tailwind
// https://tailwindcss.com/docs/customizing-colors
const tailwindColorNames = [
  'red',
  'yellow',
  'emerald',
  'sky',
  'violet',
  'pink',
  'orange',
  'lime',
  'neutral',
  'blue',
  'rose',
  'amber',
  'fuchsia',
  'green',
  'purple',
  'slate',
  'cyan',
  'indigo',
] as const;

// needs to be kept in sync with MULTIPLAYER_COLORS_TINT
export const MULTIPLAYER_COLORS = tailwindColorNames.map((colorName) => colors[colorName][600]);
export const MULTIPLAYER_COLORS_TINT = MULTIPLAYER_COLORS.map((hexStr) => parseInt(hexStr.slice(1), 16));
