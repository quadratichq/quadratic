import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import useLocalStorage from '@/shared/hooks/useLocalStorage';
import { createContext, Dispatch, SetStateAction, useContext, useEffect } from 'react';

/**
 * Theme context
 */
const ThemeContext = createContext({
  accentColor: 'blue',
  setAccentColor: (color: AccentColor) => {},
  appearanceMode: 'light',
  setAppearanceMode: (mode: AppearanceMode) => {},
});

/**
 * Theme hook
 */
export const useTheme = () => useContext(ThemeContext);

/**
 * Theme wrapper component
 */
export function Theme({ children }: { children: React.ReactNode }) {
  const [appearanceMode, setAppearanceMode] = useAppearanceMode();
  const [accentColor, setAccentColor] = useAccentColor();
  return (
    <ThemeContext.Provider value={{ appearanceMode, setAppearanceMode, accentColor, setAccentColor }}>
      {children}
    </ThemeContext.Provider>
  );
}

/**
 * =============================================================================
 * Theme value: appearance mode (e.g. light/dark/system)
 * =============================================================================
 */
type AppearanceMode = 'light' | 'dark' | 'system';
export const appearanceModes: AppearanceMode[] = ['light', 'dark', 'system'];

const useAppearanceMode = () => {
  const state = useLocalStorage('theme', 'light') as [AppearanceMode, Dispatch<SetStateAction<AppearanceMode>>];
  const [appearanceMode] = state;
  const darkModePreference = window.matchMedia('(prefers-color-scheme: dark)');
  const lightModePreference = window.matchMedia('(prefers-color-scheme: light)');

  // User change prefernce via UI preference
  useEffect(() => {
    if (appearanceMode === 'dark' || appearanceMode === 'light') {
      changeAppearanceMode(appearanceMode);
    } else if (appearanceMode === 'system') {
      changeAppearanceMode(darkModePreference.matches ? 'dark' : 'light');
    }
  }, [appearanceMode, darkModePreference]);

  // User change preference via browser
  useEffect(() => {
    const handleMatch = (e: MediaQueryListEvent) => {
      if (appearanceMode === 'system' && e.matches) {
        changeAppearanceMode(e.media.includes('dark') ? 'dark' : 'light');
      }
    };

    darkModePreference.addEventListener('change', handleMatch);
    lightModePreference.addEventListener('change', handleMatch);
    return () => {
      darkModePreference.removeEventListener('change', handleMatch);
      lightModePreference.removeEventListener('change', handleMatch);
    };
  }, [appearanceMode, darkModePreference, lightModePreference]);

  return state;
};

function changeAppearanceMode(mode: 'light' | 'dark') {
  if (mode === 'dark') {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
}

/**
 * =============================================================================
 * Theme value: accent color
 * =============================================================================
 */

export const accentColors = ['blue', 'violet', 'orange', 'green', 'rose', 'black'] as const;
type AccentColor = (typeof accentColors)[number];

/**
 * This hook sources its value from localstorage, but gets used in multiple places
 * so it's essentially a global state value. That's why we check if it's been set
 * in useEffect before we set it, otherwise multiple hooks will try to set it.
 */
const useAccentColor = () => {
  const [accentColor, setAccentColor] = useLocalStorage<AccentColor>('accentColor', 'blue');

  useEffect(() => {
    // Set the current theme color via CSS
    document.documentElement.setAttribute('data-theme', accentColor);

    // Then figure out what that color is and set it in pixi
    // e.g. "200 10% 50%"
    const primaryColorHslString = getComputedStyle(document.documentElement).getPropertyValue('--primary');
    // "200 10% 50%" -> `[200, 10, 50]`
    const [h, s, l] = primaryColorHslString.split(' ').map((val) => Number(val.replace('%', '')));
    // [200, 10, 50] -> `#c81a7f`
    const hex = hslToHex(h, s, l).replace('#', '');
    console.log(
      `%c theme change: ${accentColor} ${primaryColorHslString}`,
      `color: white; background-color: hsl(${primaryColorHslString})`
    );
    pixiApp.setAccentColor(hex);
  }, [accentColor]);

  return [accentColor, setAccentColor] as const;
};

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
