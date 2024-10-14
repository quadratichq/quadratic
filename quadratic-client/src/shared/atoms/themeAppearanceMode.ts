import { atom, AtomEffect, DefaultValue } from 'recoil';
import { localStorageEffect } from '../utils/recoilHelpers';

const DEFAULT_APPEARANCE_MODE = 'light';
type AppearanceMode = 'light' | 'dark' | 'system';
export const appearanceModes: AppearanceMode[] = ['light', 'dark', 'system'];

/**
 * When the appearance mode changes, update the DOM so its mode of display switches
 */
const updateAppearanaceInDomEffect: AtomEffect<AppearanceMode> = ({ setSelf, onSet }) => {
  setSelf((appearanceMode) => {
    // TODO: is this right? If the atom is set to a DefaultValue, we don't need to do anything
    if (appearanceMode instanceof DefaultValue) {
      return appearanceMode;
    }

    toggleThemeInDom(appearanceMode);
    return appearanceMode;
  });

  onSet((appearanceMode) => {
    toggleThemeInDom(appearanceMode);
  });
};

/**
 * Watch the browser's preference for dark mode, which is tied to the user's
 * setting of `system`. If the browser preference changes _and_ the user's
 * preference is `system` then we react to that.
 */
const watchBrowserPreference: AtomEffect<AppearanceMode> = ({ setSelf, onSet }) => {
  const handlePrefersDarkMode = (e: MediaQueryListEvent) => {
    setSelf((appearanceMode) => {
      if (appearanceMode === 'system') {
        toggleThemeInDom(e.matches ? 'dark' : 'light');
      }
      return appearanceMode;
    });
  };

  const prefersDarkMode = window.matchMedia('(prefers-color-scheme: dark)');

  prefersDarkMode.addEventListener('change', handlePrefersDarkMode);
  return () => {
    prefersDarkMode.removeEventListener('change', handlePrefersDarkMode);
  };
};

/**
 * Atom
 */
export const themeAppearanceModeAtom = atom<AppearanceMode>({
  key: 'themeAppearanceModeAtom',
  default: DEFAULT_APPEARANCE_MODE,
  // TODO: we'll need an effect for dark mode when it's supported
  effects: [localStorageEffect('themeAppearanceModeAtom'), watchBrowserPreference, updateAppearanaceInDomEffect],
});

/*
 * Function that reaches into the DOM and updates the display of the theme
 */
function toggleThemeInDom(mode: AppearanceMode) {
  if (mode === 'system') {
    toggleThemeInDom(window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  } else if (mode === 'dark') {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
}
