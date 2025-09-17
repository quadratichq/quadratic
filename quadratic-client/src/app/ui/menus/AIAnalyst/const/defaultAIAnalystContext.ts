import type { Context } from 'quadratic-shared/typesAndSchemasAI';
import { atom } from 'recoil';

export const defaultAIAnalystContext: Context = {
  sheets: [],
  currentSheet: '',
  selection: undefined,
};

export const aiContextAtom = atom<Context>({
  key: 'aiContext',
  default: defaultAIAnalystContext,
});
