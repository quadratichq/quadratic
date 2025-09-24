import type { Context } from 'quadratic-shared/typesAndSchemasAI';
import { atom } from 'recoil';

export const defaultAIAnalystContext: Context = {
  codeCell: undefined,
  connection: undefined,
};

export const aiContextAtom = atom<Context>({
  key: 'aiContext',
  default: defaultAIAnalystContext,
});
