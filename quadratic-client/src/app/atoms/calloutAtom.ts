import { atom } from 'jotai';

export type CalloutSide = 'top' | 'bottom' | 'left' | 'right';

export interface Callout {
  id: string;
  side: CalloutSide;
  text: string;
}

export interface CalloutState {
  callouts: Callout[];
}

export const calloutAtom = atom<CalloutState>({
  callouts: [],
});
