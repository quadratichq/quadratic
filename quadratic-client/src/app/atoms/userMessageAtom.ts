import { atom } from 'recoil';

interface UserMessageState {
  message: string | undefined;
}

const defaultBorderMenuState: UserMessageState = {
  message: undefined,
};

export const userMessageAtom = atom({
  key: 'userMessageState',
  default: defaultBorderMenuState,
});
