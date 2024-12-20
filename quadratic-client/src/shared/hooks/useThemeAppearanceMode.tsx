import { useFeatureFlag } from '@/shared/hooks/useFeatureFlag';
import useLocalStorage from '@/shared/hooks/useLocalStorage';
import { getCSSVariableAsHexColor } from '@/shared/utils/colors';
import { useEffect } from 'react';

const DEFAULT_APPEARANCE_MODE = 'light';
type AppearanceMode = 'light' | 'dark' | 'system';
export const appearanceModes: AppearanceMode[] = ['light', 'dark', 'system'];

/**
 * Use this hook anywhere to get the current appearance mode.
 */
export const useThemeAppearanceMode = () => {
  const state = useLocalStorage('useThemeAppearanceMode', DEFAULT_APPEARANCE_MODE);
  return state;
};

/**
 * This component should be mounted in one place at the root of the app and it
 * will handle responding to changes via the effects.
 */
export const ThemeAppearanceModeEffects = () => {
  const [featureFlag] = useFeatureFlag('themeAppearanceMode');
  const [appearanceMode, setAppearanceMode] = useThemeAppearanceMode();
  const userPrefersDarkMode = window.matchMedia('(prefers-color-scheme: dark)');

  // If the user turns the feature off, reset it to the default
  useEffect(() => {
    if (featureFlag === false) {
      setAppearanceMode(DEFAULT_APPEARANCE_MODE);
    }
  }, [featureFlag, setAppearanceMode]);

  // User changes their preference via _our_ UI
  useEffect(() => {
    if (appearanceMode === 'dark' || appearanceMode === 'light') {
      changeAppearanceModeInDom(appearanceMode);
    } else if (appearanceMode === 'system') {
      changeAppearanceModeInDom(userPrefersDarkMode.matches ? 'dark' : 'light');
    }
  }, [appearanceMode, userPrefersDarkMode]);

  // User changes their preference via _their_ system (browser or OS)
  useEffect(() => {
    const handleMatch = (e: MediaQueryListEvent) => {
      if (appearanceMode === 'system') {
        changeAppearanceModeInDom(e.matches ? 'dark' : 'light');
      }
    };

    userPrefersDarkMode.addEventListener('change', handleMatch);
    return () => {
      userPrefersDarkMode.removeEventListener('change', handleMatch);
    };
  }, [appearanceMode, userPrefersDarkMode]);

  useEffect(() => {
    const metaTag = document.querySelector('meta[name="theme-color"]');
    const hexColor = getCSSVariableAsHexColor('background');

    if (metaTag) {
      metaTag.setAttribute('content', hexColor);
    } else {
      const meta = document.createElement('meta');
      meta.name = 'theme-color';
      meta.content = hexColor;
      document.head.appendChild(meta);
    }
  }, [appearanceMode, userPrefersDarkMode]);

  return null;
};

function changeAppearanceModeInDom(mode: 'light' | 'dark') {
  if (mode === 'dark') {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
}
