import { debug } from '@/app/debugFlags';
import type { SetValue } from '@/shared/hooks/useLocalStorage';
import useLocalStorage from '@/shared/hooks/useLocalStorage';
import { DEFAULT_MODEL, DEFAULT_MODEL_VERSION, MODELS_CONFIGURATION } from 'quadratic-shared/ai/models/AI_MODELS';
import type { ModelConfig, ModelKey } from 'quadratic-shared/typesAndSchemasAI';
import { useEffect, useMemo } from 'react';

export function useAIModel(): [ModelKey, SetValue<ModelKey>, ModelConfig] {
  const [model, setModel] = useLocalStorage<ModelKey>('aiModel', DEFAULT_MODEL);
  const [version, setVersion] = useLocalStorage<number>('aiModelVersion', 0);

  const config = useMemo(() => {
    return MODELS_CONFIGURATION[model];
  }, [model]);

  const defaultConfig = useMemo(() => {
    return MODELS_CONFIGURATION[DEFAULT_MODEL];
  }, []);

  if (!defaultConfig) {
    throw new Error(`Default model ${DEFAULT_MODEL} not found`);
  }

  // This is to force update model stored in local storage to the current default model
  useEffect(() => {
    if (version !== DEFAULT_MODEL_VERSION) {
      setModel(DEFAULT_MODEL);
      setVersion(DEFAULT_MODEL_VERSION);
    }
  }, [setModel, setVersion, version]);

  // If the model is removed from the MODELS object or is not enabled, set the model to the current default model
  useEffect(() => {
    if (!config || (!debug && !config.enabled)) {
      setModel(DEFAULT_MODEL);
    }
  }, [config, setModel]);

  if (!config) {
    return [DEFAULT_MODEL, setModel, defaultConfig];
  }

  return [model, setModel, config];
}
