import useLocalStorage, { SetValue } from '@/shared/hooks/useLocalStorage';
import { AnthropicModel, OpenAIModel } from 'quadratic-shared/typesAndSchemasAI';

export function useAIAssistantModel(): [AnthropicModel | OpenAIModel, SetValue<AnthropicModel | OpenAIModel>] {
  const [model, setModel] = useLocalStorage<AnthropicModel | OpenAIModel>(
    'aiAssistantModel',
    'claude-3-5-sonnet-20240620'
  );
  return [model, setModel];
}
