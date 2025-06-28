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
  const [version, setVersion] = useLocalStorage<number>(MODEL_VERSION_LOCAL_STORAGE_KEY, DEFAULT_MODEL_VERSION);

  // This is to force update model stored in local storage to the current default model
  useEffect(() => {
    if (version !== DEFAULT_MODEL_VERSION) {
      setModelKey(DEFAULT_MODEL_FREE);
      setVersion(DEFAULT_MODEL_VERSION);

      const defaultConfig = MODELS_CONFIGURATION[DEFAULT_MODEL_FREE];
      if ('thinkingToggle' in defaultConfig) {
        setThinkingToggle(!!defaultConfig.thinking);
      }
    }
  }, [setModelKey, setThinkingToggle, setVersion, version]);

  // If the model is removed from the MODELS object or is not enabled, set the model to the current default model
  useEffect(() => {
    const config = MODELS_CONFIGURATION[modelKey];
    if (!config || (!debug && config.mode === 'disabled')) {
      setModelKey(DEFAULT_MODEL_FREE);
      setVersion(DEFAULT_MODEL_VERSION);

      const defaultConfig = MODELS_CONFIGURATION[DEFAULT_MODEL_FREE];
      if ('thinkingToggle' in defaultConfig) {
        setThinkingToggle(!!defaultConfig.thinking);
      }
    }
  }, [debug, modelKey, setModelKey, setThinkingToggle, setVersion]);

  const defaultConfig = useMemo(() => MODELS_CONFIGURATION[DEFAULT_MODEL_FREE], []);
  if (!defaultConfig) {
    throw new Error(`Default model ${DEFAULT_MODEL_FREE} not found`);
  }

  const modelConfig = useMemo(() => MODELS_CONFIGURATION[modelKey], [modelKey]);
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
