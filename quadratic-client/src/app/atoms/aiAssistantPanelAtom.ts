import { AIMessage, AnthropicModel, OpenAIModel, UserMessage } from 'quadratic-shared/typesAndSchemasAI';
import { atom, DefaultValue, selector } from 'recoil';

type AiAssistantPanelState = {
  abortController?: AbortController;
  loading: boolean;
  messages: (UserMessage | AIMessage)[];
  model: AnthropicModel | OpenAIModel;
  prompt: string;
};

const defaultAiAssistantPanelState: AiAssistantPanelState = {
  loading: false,
  messages: [],
  model: 'claude-3-5-sonnet-20240620',
  prompt: '',
};

export const aiAssistantPanelAtom = atom<AiAssistantPanelState>({
  key: 'aiAssistantPanelAtom',
  default: defaultAiAssistantPanelState,
});

export const aiAssistantPanelMessagesAtom = selector<AiAssistantPanelState['messages']>({
  key: 'aiAssistantPanelMessagesAtom',
  get: ({ get }) => {
    return get(aiAssistantPanelAtom).messages;
  },
  set: ({ set }, newValue) => {
    set(aiAssistantPanelAtom, (prev) => ({
      ...prev,
      messages: newValue instanceof DefaultValue ? prev.messages : newValue,
    }));
  },
});

export const aiAssistantPanelModelAtom = selector<AiAssistantPanelState['model']>({
  key: 'aiAssistantPanelModelAtom',
  get: ({ get }) => {
    return get(aiAssistantPanelAtom).model;
  },
  set: ({ set }, newValue) => {
    set(aiAssistantPanelAtom, (prev) => ({ ...prev, model: newValue instanceof DefaultValue ? prev.model : newValue }));
  },
});
