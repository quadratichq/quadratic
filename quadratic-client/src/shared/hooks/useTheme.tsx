import useLocalStorage from '@/shared/hooks/useLocalStorage';
import { sharedEvents } from '@/shared/sharedEvents';
import type { Dispatch, SetStateAction } from 'react';
import { useEffect } from 'react';

type Theme = 'light' | 'dark' | 'system';
type ThemePreference = null | Theme;
export const themes: Theme[] = ['light', 'dark', 'system'];

export const useTheme = () => {
  const state = useLocalStorage('theme', null) as [ThemePreference, Dispatch<SetStateAction<ThemePreference>>];
  const [theme] = state;
  const darkModePreference = window.matchMedia('(prefers-color-scheme: dark)');
  const lightModePreference = window.matchMedia('(prefers-color-scheme: light)');

  // User change prefernce via UI preference
  useEffect(() => {
    if (theme === 'dark' || theme === 'light') {
      changeTheme(theme);
    } else if (theme === 'system') {
      changeTheme(darkModePreference.matches ? 'dark' : 'light');
    }
  }, [theme, darkModePreference]);

  // User change preference via browser
  useEffect(() => {
    const handleMatch = (e: MediaQueryListEvent) => {
      if (theme === 'system' && e.matches) {
        changeTheme(e.media.includes('dark') ? 'dark' : 'light');
      }
    };

    darkModePreference.addEventListener('change', handleMatch);
    lightModePreference.addEventListener('change', handleMatch);
    return () => {
      darkModePreference.removeEventListener('change', handleMatch);
      lightModePreference.removeEventListener('change', handleMatch);
    };
  }, [theme, darkModePreference, lightModePreference]);

  return state;
};

function changeTheme(newTheme: 'light' | 'dark') {
  if (newTheme === 'dark') {
    document.body.classList.add('dark');
  } else {
    document.body.classList.remove('dark');
  }

  // Notify PixiJS components so they re-read CSS variables for the new theme
  sharedEvents.emit('changeThemeAccentColor');
}
