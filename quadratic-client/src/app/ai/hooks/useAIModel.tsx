import { MODEL_OPTIONS } from '@/app/ai/MODELS';
import useLocalStorage, { SetValue } from '@/shared/hooks/useLocalStorage';
import { AIModel } from 'quadratic-shared/typesAndSchemasAI';

export function useAIModel(): [AIModel, SetValue<AIModel>] {
  const [model, setModel] = useLocalStorage<AIModel>('aiModel', 'gpt-4o-2024-08-06');

  // If the model is removed from the MODELS object or is not enabled, set the model to the first enabled model
  if (!MODEL_OPTIONS[model] || !MODEL_OPTIONS[model].enabled) {
    const models = Object.keys(MODEL_OPTIONS) as (keyof typeof MODEL_OPTIONS)[];
    const newModel = models.find((model) => MODEL_OPTIONS[model].enabled);
    if (newModel) {
      setModel(newModel);
      return [newModel, setModel];
    } else {
      throw new Error('No enabled models found');
    }
  }

  return [model, setModel];
}
