import { Dispatch, SetStateAction, useEffect } from 'react';
import useLocalStorage from './useLocalStorage';

type Theme = 'light' | 'dark' | 'system';
type ThemePreference = null | Theme;
export const themes: Theme[] = ['light', 'dark', 'system'];

export const useTheme = () => {
  const value = useLocalStorage('theme', null) as [ThemePreference, Dispatch<SetStateAction<ThemePreference>>];
  const [theme] = value;

  useEffect(() => {
    if (theme === 'dark') {
      document.body.classList.add('dark');
    } else if (theme === 'light') {
      document.body.classList.remove('dark');
    } else if (theme === 'system') {
      if (window.matchMedia('(prefers-color-scheme: dark)')) {
        document.body.classList.add('dark');
      } else {
        document.body.classList.remove('dark');
      }
    }
  }, [theme]);

  return value;
};
