import useLocalStorage, { SetValue } from '@/shared/hooks/useLocalStorage';
import { AnthropicModel, OpenAIModel } from 'quadratic-shared/typesAndSchemasAI';

export function useAIModel(): [AnthropicModel | OpenAIModel, SetValue<AnthropicModel | OpenAIModel>] {
  const [model, setModel] = useLocalStorage<AnthropicModel | OpenAIModel>('aiModel', 'gpt-4o');
  return [model, setModel];
}
