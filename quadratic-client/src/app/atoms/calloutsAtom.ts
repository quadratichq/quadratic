import { atom } from 'jotai';

export type CalloutSide = 'top' | 'bottom' | 'left' | 'right';

export interface Callout {
  element: HTMLElement;
  side: CalloutSide;
  text: string;
}

export interface CalloutState {
  callouts: Callout[];
}

export const calloutsAtom = atom<CalloutState>({
  callouts: [],
});
