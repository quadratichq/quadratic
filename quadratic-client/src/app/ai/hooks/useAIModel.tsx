import { useDebugFlags } from '@/app/debugFlags/useDebugFlags';
import { useIsOnPaidPlan } from '@/app/ui/hooks/useIsOnPaidPlan';
import type { SetValue } from '@/shared/hooks/useLocalStorage';
import useLocalStorage from '@/shared/hooks/useLocalStorage';
import { DEFAULT_MODEL, DEFAULT_MODEL_VERSION, MODELS_CONFIGURATION } from 'quadratic-shared/ai/models/AI_MODELS';
import type { AIModelConfig, AIModelKey } from 'quadratic-shared/typesAndSchemasAI';
import { useEffect, useMemo } from 'react';

const MODEL_LOCAL_STORAGE_KEY = 'aiModel';
const MODEL_VERSION_LOCAL_STORAGE_KEY = 'aiModelVersion';

export const useAIModel = (): {
  isOnPaidPlan: boolean;
  modelKey: AIModelKey;
  setModelKey: SetValue<AIModelKey>;
  modelConfig: AIModelConfig;
} => {
  // Clear older versions of the model and thinking toggle from local storage
  useEffect(() => {
    window.localStorage.removeItem(MODEL_LOCAL_STORAGE_KEY);
    window.localStorage.removeItem(MODEL_VERSION_LOCAL_STORAGE_KEY);
    for (let i = 0; i < DEFAULT_MODEL_VERSION; i++) {
      window.localStorage.removeItem(`${MODEL_LOCAL_STORAGE_KEY}-${i}`);
    }
  }, []);

  const { isOnPaidPlan } = useIsOnPaidPlan();

  const defaultConfig = useMemo(() => MODELS_CONFIGURATION[DEFAULT_MODEL], []);
  if (!defaultConfig) {
    throw new Error(`Default model ${DEFAULT_MODEL} not found`);
  }

  const { debug } = useDebugFlags();

  const modelLocalStorageKey = useMemo(() => `${MODEL_LOCAL_STORAGE_KEY}-${DEFAULT_MODEL_VERSION}`, []);
  const defaultModelKey = useMemo(() => DEFAULT_MODEL, []);
  const [modelKey, setModelKey] = useLocalStorage<AIModelKey>(modelLocalStorageKey, defaultModelKey);

  const modelConfig = useMemo(() => MODELS_CONFIGURATION[modelKey], [modelKey]);

  // If the model is removed from the MODELS object or is not enabled, set the model to the current default model
  useEffect(() => {
    if (debug) return;
    if (!modelConfig || modelConfig.mode === 'disabled') {
      setModelKey(DEFAULT_MODEL);
    }
  }, [debug, defaultConfig, modelConfig, setModelKey]);

  if (!modelConfig) {
    return {
      isOnPaidPlan,
      modelKey: DEFAULT_MODEL,
      setModelKey,
      modelConfig: defaultConfig,
    };
  }

  return { isOnPaidPlan, modelKey, setModelKey, modelConfig };
};
