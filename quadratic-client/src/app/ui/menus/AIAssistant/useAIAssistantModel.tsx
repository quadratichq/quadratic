import useLocalStorage, { SetValue } from '@/shared/hooks/useLocalStorage';
import { AnthropicModel, OpenAIModel } from 'quadratic-shared/typesAndSchemasAI';

export function useAIAssistantModel(): [AnthropicModel | OpenAIModel, SetValue<AnthropicModel | OpenAIModel>] {
  const [model, setModel] = useLocalStorage<AnthropicModel | OpenAIModel>('aiAssistantModel', 'gpt-4o');
  return [model, setModel];
}
