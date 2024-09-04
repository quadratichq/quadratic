import { atom } from 'recoil';

interface FileDragDropModalState {
  show: boolean;
  teamUuid?: string;
  isPrivate?: boolean;
}

const fileDragDropModalState: FileDragDropModalState = {
  show: false,
  teamUuid: undefined,
  isPrivate: undefined,
};

export const fileDragDropModalAtom = atom({
  key: 'fileDragDropModal',
  default: fileDragDropModalState,
});
