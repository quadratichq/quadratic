import { debug } from '@/app/debugFlags';
import type { SetValue } from '@/shared/hooks/useLocalStorage';
import useLocalStorage from '@/shared/hooks/useLocalStorage';
import { DEFAULT_MODEL, DEFAULT_MODEL_VERSION, MODELS_CONFIGURATION } from 'quadratic-shared/ai/models/AI_MODELS';
import type { ModelConfig, ModelKey } from 'quadratic-shared/typesAndSchemasAI';
import { useEffect, useMemo } from 'react';

export function useAIModel(): [ModelKey, SetValue<ModelKey>, ModelConfig] {
  const [modelKey, setModelKey] = useLocalStorage<ModelKey>('aiModel', DEFAULT_MODEL);
  const [version, setVersion] = useLocalStorage<number>('aiModelVersion', 0);

  // This is to force update model stored in local storage to the current default model
  useEffect(() => {
    if (version !== DEFAULT_MODEL_VERSION) {
      setModelKey(DEFAULT_MODEL);
      setVersion(DEFAULT_MODEL_VERSION);
    }
  }, [setModelKey, setVersion, version]);

  // If the model is removed from the MODELS object or is not enabled, set the model to the current default model
  useEffect(() => {
    const config = MODELS_CONFIGURATION[modelKey];
    if (!config || (!debug && !config.enabled)) {
      setModelKey(DEFAULT_MODEL);
      setVersion(DEFAULT_MODEL_VERSION);
    }
  }, [modelKey, setModelKey, setVersion]);

  const config = useMemo(() => {
    return MODELS_CONFIGURATION[modelKey];
  }, [modelKey]);

  const defaultConfig = useMemo(() => {
    return MODELS_CONFIGURATION[DEFAULT_MODEL];
  }, []);
  if (!defaultConfig) {
    throw new Error(`Default model ${DEFAULT_MODEL} not found`);
  }

  if (!config) {
    return [DEFAULT_MODEL, setModelKey, defaultConfig];
  }

  return [modelKey, setModelKey, config];
}
