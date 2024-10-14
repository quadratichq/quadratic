import { localStorageEffect } from '@/shared/utils/recoilHelpers';
import { atom, DefaultValue, selector } from 'recoil';
import { themeAccentColorAtom } from './themeAccentColor';
import { themeAppearanceModeAtom } from './themeAppearanceMode';

const flagAtom = atom({
  key: 'featureFlagAtom',
  default: { themeAccentColor: false, themeAppearanceMode: false },
  effects: [localStorageEffect('featureFlagAtom')],
});

export const featureFlagState = selector({
  key: 'featureFlagState',
  get: ({ get }) => get(flagAtom),
  set: ({ set, reset }, flags) => {
    if (flags instanceof DefaultValue) return;

    if (flags.themeAccentColor === false) {
      reset(themeAccentColorAtom);
    }

    if (flags.themeAppearanceMode === false) {
      reset(themeAppearanceModeAtom);
    }

    set(flagAtom, flags);
  },
});
