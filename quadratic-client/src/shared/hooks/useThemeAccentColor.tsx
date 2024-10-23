import { useFeatureFlag } from '@/shared/hooks/useFeatureFlag';
import useLocalStorage from '@/shared/hooks/useLocalStorage';
import { sharedEvents } from '@/shared/sharedEvents';
import { useEffect } from 'react';

const DEFAULT_ACCENT_COLOR = 'blue';
export const themeAccentColors = ['blue', 'violet', 'orange', 'green', 'rose', 'black'] as const;
type AccentColor = (typeof themeAccentColors)[number];

export const useThemeAccentColor = () => {
  const state = useLocalStorage<AccentColor>('accentColor', DEFAULT_ACCENT_COLOR);
  return state;
};

export const ThemeAccentColorEffects = () => {
  const [accentColor, setAccentColor] = useThemeAccentColor();
  const [featureFlag] = useFeatureFlag('themeAccentColor');

  // If the user turns the feature off, reset it to the default
  useEffect(() => {
    if (featureFlag === false) {
      setAccentColor(DEFAULT_ACCENT_COLOR);
    }
  }, [featureFlag, setAccentColor]);

  // Update the theme color in the UI
  useEffect(() => {
    // Set the current theme color variable in CSS via the DOM
    document.documentElement.setAttribute('data-theme', accentColor);

    // Set in pixi
    sharedEvents.emit('changeThemeAccentColor');
  }, [accentColor]);

  return null;
};
