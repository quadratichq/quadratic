import { atom, DefaultValue, selector } from 'recoil';
import { themeAccentColorAtom } from './themeAccentColor';

const flagAtom = atom({
  key: 'featureFlagAtom',
  default: { themeAccentColor: true },
});

export const featureFlagSelector = selector({
  key: 'countSelector',
  get: ({ get }) => get(flagAtom),
  set: ({ set }, flags) => {
    if (flags instanceof DefaultValue) return;

    if (flags.themeAccentColor === false) {
      set(themeAccentColorAtom, 'blue');
    }

    set(flagAtom, flags);
  },
});
