import { ExaSearchRequestBody } from 'quadratic-shared/typesAndSchemasAI';
import { atom } from 'recoil';

type ExaSettingsState = Omit<ExaSearchRequestBody, 'query'>;

export const defaultExaSettingsState: ExaSettingsState = {
  type: 'auto',
  numResults: 5,
  livecrawl: 'fallback',
  useAutoprompt: true,
  text: true,
  highlights: true,
  summary: true,
  includeText: [],
  excludeText: [],
  includeDomains: [],
  excludeDomains: [],
  startPublishedDate: '',
  endPublishedDate: '',
};

export const exaSettingsAtom = atom<ExaSettingsState>({
  key: 'exaSettingsAtom',
  default: defaultExaSettingsState,
});
