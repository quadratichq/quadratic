import { atom, useRecoilState } from 'recoil';

const aiModeAtom = atom<'chat' | 'planning'>({
  key: 'aiMode',
  default: 'chat',
});

export function useAIMode() {
  return useRecoilState(aiModeAtom);
} 