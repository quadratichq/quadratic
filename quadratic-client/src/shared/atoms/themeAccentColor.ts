import { sharedEvents } from '@/shared/sharedEvents';
import { localStorageEffect } from '@/shared/utils/recoilHelpers';
import { atom, AtomEffect, DefaultValue } from 'recoil';

const KEY = 'themeAccentColor';

// Note: the colors here must match the ones in `@/shared/shadcn/styles.css`
export const themeAccentColors = ['blue', 'violet', 'orange', 'green', 'rose', 'black'] as const;
type ThemeAccentColor = (typeof themeAccentColors)[number];
const defaultThemeAccentColor: ThemeAccentColor = 'blue';

/**
 * Set the current theme color via CSS, this handles styling on DOM elements
 */
const setInDomEffect: AtomEffect<ThemeAccentColor> = ({ onSet, trigger, setSelf }) => {
  const setInDom = (accentColor: ThemeAccentColor) => {
    document.documentElement.setAttribute('data-theme', accentColor);
  };

  // This will run when the atom is initially set up
  setSelf((currentValue) => {
    console.log('<recoil>: setInDom:initialize', currentValue);
    setInDom(currentValue instanceof DefaultValue ? defaultThemeAccentColor : currentValue);
    return currentValue;
  });

  onSet((accentColor: ThemeAccentColor) => {
    console.log('<recoil>: setInDom:onChange', accentColor);
    setInDom(accentColor);
  });
};

/**
 * Figure out what that color is and set it in pixi, this handles styling
 * on the grid via pixi
 */
const setInPixiEffect: AtomEffect<ThemeAccentColor> = ({ onSet, setSelf }) => {
  const setInPixi = () => {
    // e.g. "200 10% 50%"
    const primaryColorHslString = getComputedStyle(document.documentElement).getPropertyValue('--primary');
    // "200 10% 50%" -> `[200, 10, 50]`
    const [h, s, l] = primaryColorHslString.split(' ').map((val) => Number(val.replace('%', '')));
    // [200, 10, 50] -> `#c81a7f`
    const hex = hslToHex(h, s, l).replace('#', '');
    const hexColorCode = Number(`0x${hex}`);
    // Send to pixi
    sharedEvents.emit('changeThemeAccentColor', hexColorCode);
  };
  setSelf((currentValue) => {
    console.log('<recoil>: setInPixi:initialize', currentValue);
    setInPixi();
    return currentValue;
  });
  onSet((accentColor: ThemeAccentColor) => {
    console.log('<recoil>: setInPixi:onChange', accentColor);
    setInPixi();
  });
};

// Add the otherEffect to the atom's effects
export const themeAccentColorAtom = atom({
  key: KEY,
  default: defaultThemeAccentColor,
  effects: [localStorageEffect(KEY), setInDomEffect, setInPixiEffect],
});

/**
 * Convenience function to convert HSL to hexadecimal color, as our CSS variables
 * are in HSL format but pixi wants hex.
 */
function hslToHex(h: number, s: number, l: number) {
  // Normalize the saturation and lightness values
  s /= 100;
  l /= 100;

  // Calculate the chroma (C)
  const c = (1 - Math.abs(2 * l - 1)) * s;

  // Calculate the intermediate value (X)
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));

  // Calculate the lightness match (m)
  const m = l - c / 2;

  let r = 0,
    g = 0,
    b = 0;

  if (0 <= h && h < 60) {
    r = c;
    g = x;
    b = 0;
  } else if (60 <= h && h < 120) {
    r = x;
    g = c;
    b = 0;
  } else if (120 <= h && h < 180) {
    r = 0;
    g = c;
    b = x;
  } else if (180 <= h && h < 240) {
    r = 0;
    g = x;
    b = c;
  } else if (240 <= h && h < 300) {
    r = x;
    g = 0;
    b = c;
  } else if (300 <= h && h < 360) {
    r = c;
    g = 0;
    b = x;
  }

  // Convert RGB values to [0, 255] range and add the match (m)
  r = Math.round((r + m) * 255);
  g = Math.round((g + m) * 255);
  b = Math.round((b + m) * 255);

  // Convert RGB to HEX
  const toHex = (value: number) => value.toString(16).padStart(2, '0');

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}
