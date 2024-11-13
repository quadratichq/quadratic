import { atom, DefaultValue, selector } from 'recoil';

export interface AIResearcherState {
  abortController?: AbortController;
  loading: boolean;
  query: string;
  refCell: string;
  output: string;
}

export const defaultAIResearcherState: AIResearcherState = {
  abortController: undefined,
  loading: false,
  query: '',
  refCell: '',
  output: '',
};

export const aiResearcherAtom = atom<AIResearcherState>({
  key: 'aiResearcherAtom',
  default: defaultAIResearcherState,
});

const createSelector = <T extends keyof AIResearcherState>(key: T) =>
  selector<AIResearcherState[T]>({
    key: `aiResearcher${key.charAt(0).toUpperCase() + key.slice(1)}Atom`,
    get: ({ get }) => get(aiResearcherAtom)[key],
    set: ({ set }, newValue) =>
      set(aiResearcherAtom, (prev) => ({
        ...prev,
        [key]: newValue instanceof DefaultValue ? prev[key] : newValue,
      })),
  });
export const aiResearcherAbortControllerAtom = createSelector('abortController');
export const aiResearcherLoadingAtom = createSelector('loading');
export const aiResearcherQueryAtom = createSelector('query');
export const aiResearcherRefCellAtom = createSelector('refCell');
export const aiResearcherOutputAtom = createSelector('output');
