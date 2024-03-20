import { atom } from 'recoil';

// https://recoiljs.org/docs/guides/atom-effects#local-storage-persistence
const localStorageEffect =
  (key: any) =>
  ({ setSelf, onSet }: any) => {
    const savedValue = localStorage.getItem(key);
    if (savedValue != null) {
      setSelf(JSON.parse(savedValue));
    }

    onSet((newValue: any, _: any, isReset: any) => {
      isReset ? localStorage.removeItem(key) : localStorage.setItem(key, JSON.stringify(newValue));
    });
  };

export const cellTypeMenuOpenedCountAtom = atom({
  key: 'cellTypeMenuOpenedCount',
  default: 0,
  effects: [localStorageEffect('cellTypeMenuOpenedCount-2024-03-20')],
});
