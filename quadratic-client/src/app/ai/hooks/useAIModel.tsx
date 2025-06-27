import { useDebugFlags } from '@/app/debugFlags/useDebugFlags';
import type { SetValue } from '@/shared/hooks/useLocalStorage';
import useLocalStorage from '@/shared/hooks/useLocalStorage';
import { DEFAULT_MODEL_FREE, DEFAULT_MODEL_VERSION, MODELS_CONFIGURATION } from 'quadratic-shared/ai/models/AI_MODELS';
import type { AIModelConfig, AIModelKey } from 'quadratic-shared/typesAndSchemasAI';
import { useEffect, useMemo } from 'react';

const MODEL_LOCAL_STORAGE_KEY = 'aiModel';
const THINKING_TOGGLE_LOCAL_STORAGE_KEY = 'aiThinkingToggle';
const MODEL_VERSION_LOCAL_STORAGE_KEY = 'aiModelVersion';

export const useAIModel = (): {
  modelKey: AIModelKey;
  setModelKey: SetValue<AIModelKey>;
  modelConfig: AIModelConfig;
  thinkingToggle: boolean;
  setThinkingToggle: SetValue<boolean>;
} => {
  const { debug } = useDebugFlags();

  const [modelKey, setModelKey] = useLocalStorage<AIModelKey>(MODEL_LOCAL_STORAGE_KEY, DEFAULT_MODEL_FREE);
  const [thinkingToggle, setThinkingToggle] = useLocalStorage<boolean>(THINKING_TOGGLE_LOCAL_STORAGE_KEY, false);
  const [version] = useLocalStorage<number>('aiModelVersion', 0);

  // This is to force update model stored in local storage to the current default model
  useEffect(() => {
    if (version !== DEFAULT_MODEL_VERSION) {
      window.localStorage.setItem(MODEL_LOCAL_STORAGE_KEY, JSON.stringify(DEFAULT_MODEL_FREE));
      window.localStorage.setItem(MODEL_VERSION_LOCAL_STORAGE_KEY, JSON.stringify(DEFAULT_MODEL_VERSION));

      const modelConfig = MODELS_CONFIGURATION[DEFAULT_MODEL_FREE];
      if ('thinkingToggle' in modelConfig) {
        window.localStorage.setItem(THINKING_TOGGLE_LOCAL_STORAGE_KEY, JSON.stringify(!!modelConfig.thinking));
      }
    }
  }, [version]);

  // If the model is removed from the MODELS object or is not enabled, set the model to the current default model
  useEffect(() => {
    const config = MODELS_CONFIGURATION[modelKey];
    if (!config || (!debug && config.mode === 'disabled')) {
      window.localStorage.setItem(MODEL_LOCAL_STORAGE_KEY, JSON.stringify(DEFAULT_MODEL_FREE));
      window.localStorage.setItem(MODEL_VERSION_LOCAL_STORAGE_KEY, JSON.stringify(DEFAULT_MODEL_VERSION));
    }
  }, [debug, modelKey]);

  const modelConfig = useMemo(() => {
    return MODELS_CONFIGURATION[modelKey];
  }, [modelKey]);

  const defaultConfig = useMemo(() => {
    return MODELS_CONFIGURATION[DEFAULT_MODEL_FREE];
  }, []);
  if (!defaultConfig) {
    throw new Error(`Default model ${DEFAULT_MODEL_FREE} not found`);
  }

  if (!modelConfig) {
    return {
      modelKey: DEFAULT_MODEL_FREE,
      setModelKey,
      modelConfig: defaultConfig,
      thinkingToggle,
      setThinkingToggle,
    };
  }

  return { modelKey, setModelKey, modelConfig, thinkingToggle, setThinkingToggle };
};
