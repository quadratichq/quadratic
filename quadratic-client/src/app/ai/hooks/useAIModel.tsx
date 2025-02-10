import { debug } from '@/app/debugFlags';
import type { SetValue } from '@/shared/hooks/useLocalStorage';
import useLocalStorage from '@/shared/hooks/useLocalStorage';
import { DEFAULT_MODEL, DEFAULT_MODEL_VERSION, MODEL_OPTIONS } from 'quadratic-shared/ai/models/AI_MODELS';
import type { AIModel } from 'quadratic-shared/typesAndSchemasAI';
import { useEffect } from 'react';

export function useAIModel(): [AIModel, SetValue<AIModel>] {
  const [model, setModel] = useLocalStorage<AIModel>('aiModel', DEFAULT_MODEL);
  const [version, setVersion] = useLocalStorage<number>('aiModelVersion', 0);

  // This is to force update model stored in local storage to the current default model
  useEffect(() => {
    if (version !== DEFAULT_MODEL_VERSION) {
      setModel(DEFAULT_MODEL);
      setVersion(DEFAULT_MODEL_VERSION);
    }
  }, [setModel, setVersion, version]);

  // If the model is removed from the MODELS object or is not enabled, set the model to the current default model
  useEffect(() => {
    if (!MODEL_OPTIONS[model] || (!debug && !MODEL_OPTIONS[model].enabled)) {
      setModel(DEFAULT_MODEL);
    }
  }, [model, setModel]);

  return [model, setModel];
}
