import { debug } from '@/app/debugFlags';
import type { SetValue } from '@/shared/hooks/useLocalStorage';
import useLocalStorage from '@/shared/hooks/useLocalStorage';
import { DEFAULT_MODEL, DEFAULT_MODEL_VERSION, MODELS_CONFIGURATION } from 'quadratic-shared/ai/models/AI_MODELS';
import type { ModelConfig, ModelKey } from 'quadratic-shared/typesAndSchemasAI';
import { useEffect, useMemo } from 'react';

const MODEL_LOCAL_STORAGE_KEY = 'aiModel';
const THINKING_TOGGLE_LOCAL_STORAGE_KEY = 'aiThinkingToggle';
const MODEL_VERSION_LOCAL_STORAGE_KEY = 'aiModelVersion';

export function useAIModel(): [ModelKey, SetValue<ModelKey>, ModelConfig, boolean, SetValue<boolean>] {
  const [modelKey, setModelKey] = useLocalStorage<ModelKey>(MODEL_LOCAL_STORAGE_KEY, DEFAULT_MODEL);
  const [thinkingToggle, setThinkingToggle] = useLocalStorage<boolean>(THINKING_TOGGLE_LOCAL_STORAGE_KEY, false);
  const [version] = useLocalStorage<number>('aiModelVersion', 0);

  // This is to force update model stored in local storage to the current default model
  useEffect(() => {
    if (version !== DEFAULT_MODEL_VERSION) {
      window.localStorage.setItem(MODEL_LOCAL_STORAGE_KEY, JSON.stringify(DEFAULT_MODEL));
      window.localStorage.setItem(MODEL_VERSION_LOCAL_STORAGE_KEY, JSON.stringify(DEFAULT_MODEL_VERSION));

      const modelConfig = MODELS_CONFIGURATION[DEFAULT_MODEL];
      if ('thinkingToggle' in modelConfig) {
        window.localStorage.setItem(THINKING_TOGGLE_LOCAL_STORAGE_KEY, JSON.stringify(!!modelConfig.thinking));
      }
    }
  }, [version]);

  // If the model is removed from the MODELS object or is not enabled, set the model to the current default model
  useEffect(() => {
    const config = MODELS_CONFIGURATION[modelKey];
    if (!config || (!debug && !config.enabled)) {
      window.localStorage.setItem(MODEL_LOCAL_STORAGE_KEY, JSON.stringify(DEFAULT_MODEL));
      window.localStorage.setItem(MODEL_VERSION_LOCAL_STORAGE_KEY, JSON.stringify(DEFAULT_MODEL_VERSION));
    }
  }, [modelKey]);

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
    return [DEFAULT_MODEL, setModelKey, defaultConfig, thinkingToggle, setThinkingToggle];
  }

  return [modelKey, setModelKey, config, thinkingToggle, setThinkingToggle];
}
