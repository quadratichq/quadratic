import { atom } from 'jotai';

export interface AITask {
  id: string;
  description: string;
  completed: boolean;
}

export const aiTaskListAtom = atom<AITask[]>([]);
export const aiTaskListMinimizedAtom = atom<boolean>(false);
