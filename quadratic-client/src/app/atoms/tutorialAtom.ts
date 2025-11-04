import { atom } from 'jotai';

export interface TutorialState {
  show: boolean;
  unmaskedElements: string[];
}

export const tutorialAtom = atom<TutorialState>({
  show: false,
  unmaskedElements: [],
});
