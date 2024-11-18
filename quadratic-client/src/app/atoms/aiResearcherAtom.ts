import { AITool } from '@/app/ai/tools/aiTools';
import { AIToolsArgsSchema } from '@/app/ai/tools/aiToolsSpec';
import { ExaSearchResultSchema } from 'quadratic-shared/typesAndSchemasAI';
import { atom, DefaultValue, selector } from 'recoil';
import { z } from 'zod';

export const AIResearcherResultSchema = z.object({
  exaResult: z.array(ExaSearchResultSchema).optional(),
  toolCallArgs: AIToolsArgsSchema[AITool.SetAIResearcherValue],
});

export type AIResearcherResult = z.infer<typeof AIResearcherResultSchema>;

export const ParseAIResearcherResult = (
  ai_researcher_result_stringified?: string | null
): AIResearcherResult | undefined => {
  if (!ai_researcher_result_stringified) {
    return undefined;
  }

  let aiResearcherResult = undefined;
  try {
    const aiResearcherResultJson = JSON.parse(ai_researcher_result_stringified);
    aiResearcherResult = AIResearcherResultSchema.parse(aiResearcherResultJson);
  } catch (e) {
    console.warn(e);
  }
  return aiResearcherResult;
};

export interface AIResearcherState {
  abortController?: AbortController;
  loading: boolean;
  query: string;
  refCell: string;
  output: string;
  aiResearcherResult?: AIResearcherResult;
}

export const defaultAIResearcherState: AIResearcherState = {
  abortController: undefined,
  loading: false,
  query: '',
  refCell: '',
  output: '',
  aiResearcherResult: undefined,
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
export const aiResearcherResultAtom = createSelector('aiResearcherResult');
