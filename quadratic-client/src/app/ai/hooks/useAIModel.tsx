import type { SetValue } from '@/shared/hooks/useLocalStorage';
import useLocalStorage from '@/shared/hooks/useLocalStorage';
import { DEFAULT_MODEL, DEFAULT_MODEL_VERSION, MODEL_OPTIONS } from 'quadratic-shared/ai/models/AI_MODELS';
import type { AIModel } from 'quadratic-shared/typesAndSchemasAI';

export function useAIModel(): [AIModel, SetValue<AIModel>] {
  const [model, setModel] = useLocalStorage<AIModel>('aiModel', DEFAULT_MODEL);
  const [version, setVersion] = useLocalStorage<number>('aiModelVersion', 0);

  // This is to update model stored in local storage to the current default model
  if (version !== DEFAULT_MODEL_VERSION) {
    setModel(DEFAULT_MODEL);
    setVersion(DEFAULT_MODEL_VERSION);
    return [DEFAULT_MODEL, setModel];
  }

  // If the model is removed from the MODELS object or is not enabled, set the model to the current default model
  if (!MODEL_OPTIONS[model] || !MODEL_OPTIONS[model].enabled) {
    setModel(DEFAULT_MODEL);
    return [DEFAULT_MODEL, setModel];
  }

  return [model, setModel];
}
