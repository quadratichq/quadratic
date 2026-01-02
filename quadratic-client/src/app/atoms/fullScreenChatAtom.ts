import { atom } from 'recoil';

export const fullScreenChatIsOpenAtom = atom<boolean>({
  key: 'fullScreenChatIsOpenAtom',
  default: false,
});
