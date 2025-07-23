import useLocalStorage from '@/shared/hooks/useLocalStorage';
import { sharedEvents } from '@/shared/sharedEvents';
import { memo, useEffect } from 'react';

const DEFAULT_ACCENT_COLOR = 'blue';
export const themeAccentColors = ['blue', 'violet', 'orange', 'green', 'rose', 'black'] as const;
type AccentColor = (typeof themeAccentColors)[number];

export const useThemeAccentColor = () => {
  const state = useLocalStorage<AccentColor>('accentColor', DEFAULT_ACCENT_COLOR);
  return state;
};

export const ThemeAccentColorEffects = memo(() => {
  const [accentColor] = useThemeAccentColor();

  // Update the theme color in the UI
  useEffect(() => {
    // Set the current theme color variable in CSS via the DOM
    document.documentElement.dataset.theme = accentColor;

    // Set in pixi
    sharedEvents.emit('changeThemeAccentColor');
  }, [accentColor]);

  return null;
});
