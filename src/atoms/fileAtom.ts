import { atom } from 'recoil';
import { GridFileSchemaV1 } from '../storage/GridFileSchema';
import type { LocalFile } from '../storage/useLocalFiles';

interface FileAtom {
  index: LocalFile[];
  loaded: boolean;
  lastFileContents?: GridFileSchemaV1;
}

export const fileAtom = atom<FileAtom>({
  key: 'file-system',
  default: { index: [], loaded: false },
});
