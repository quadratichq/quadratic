import { useDebugFlags } from '@/app/debugFlags/useDebugFlags';
import { useIsOnPaidPlan } from '@/app/ui/hooks/useIsOnPaidPlan';
import type { SetValue } from '@/shared/hooks/useLocalStorage';
import useLocalStorage from '@/shared/hooks/useLocalStorage';
import {
  DEFAULT_MODEL_FREE,
  DEFAULT_MODEL_PRO,
  DEFAULT_MODEL_VERSION,
  MODELS_CONFIGURATION,
} from 'quadratic-shared/ai/models/AI_MODELS';
import type { AIModelConfig, AIModelKey } from 'quadratic-shared/typesAndSchemasAI';
import { useEffect, useMemo } from 'react';

const MODEL_FREE_LOCAL_STORAGE_KEY = 'aiModelFree';
const MODEL_PAID_LOCAL_STORAGE_KEY = 'aiModelPaid';
const THINKING_TOGGLE_LOCAL_STORAGE_KEY = 'aiThinkingToggle';
const MODEL_VERSION_LOCAL_STORAGE_KEY = 'aiModelVersion';

export const useAIModel = (): {
  isOnPaidPlan: boolean;
  modelKey: AIModelKey;
  setModelKey: SetValue<AIModelKey>;
  modelConfig: AIModelConfig;
  thinkingToggle: boolean;
  setThinkingToggle: SetValue<boolean>;
} => {
  // Clear older versions of the model and thinking toggle from local storage
  useEffect(() => {
    window.localStorage.removeItem(MODEL_FREE_LOCAL_STORAGE_KEY);
    window.localStorage.removeItem(MODEL_PAID_LOCAL_STORAGE_KEY);
    window.localStorage.removeItem(THINKING_TOGGLE_LOCAL_STORAGE_KEY);
    window.localStorage.removeItem(MODEL_VERSION_LOCAL_STORAGE_KEY);
    for (let i = 0; i < DEFAULT_MODEL_VERSION; i++) {
      window.localStorage.removeItem(`${MODEL_FREE_LOCAL_STORAGE_KEY}-${i}`);
      window.localStorage.removeItem(`${MODEL_PAID_LOCAL_STORAGE_KEY}-${i}`);
      window.localStorage.removeItem(`${THINKING_TOGGLE_LOCAL_STORAGE_KEY}-${i}`);
    }
  }, []);

  const { isOnPaidPlan } = useIsOnPaidPlan();

  const defaultConfig = useMemo(
    () => MODELS_CONFIGURATION[isOnPaidPlan ? DEFAULT_MODEL_PRO : DEFAULT_MODEL_FREE],
    [isOnPaidPlan]
  );
  if (!defaultConfig) {
    throw new Error(`Default model ${isOnPaidPlan ? DEFAULT_MODEL_PRO : DEFAULT_MODEL_FREE} not found`);
  }

  const { debug } = useDebugFlags();

  const modelLocalStorageKey = useMemo(
    () => `${isOnPaidPlan ? MODEL_PAID_LOCAL_STORAGE_KEY : MODEL_FREE_LOCAL_STORAGE_KEY}-${DEFAULT_MODEL_VERSION}`,
    [isOnPaidPlan]
  );
  const defaultModelKey = useMemo(() => (isOnPaidPlan ? DEFAULT_MODEL_PRO : DEFAULT_MODEL_FREE), [isOnPaidPlan]);
  const [modelKey, setModelKey] = useLocalStorage<AIModelKey>(modelLocalStorageKey, defaultModelKey);

  const [thinkingToggle, setThinkingToggle] = useLocalStorage<boolean>(
    `${THINKING_TOGGLE_LOCAL_STORAGE_KEY}-${DEFAULT_MODEL_VERSION}`,
    !!defaultConfig.thinkingToggle
  );

  const modelConfig = useMemo(() => MODELS_CONFIGURATION[modelKey], [modelKey]);

  // If the model is removed from the MODELS object or is not enabled, set the model to the current default model
  useEffect(() => {
    if (debug) return;
    if (!modelConfig || modelConfig.mode === 'disabled' || (!isOnPaidPlan && modelConfig.mode === 'pro')) {
      setModelKey(isOnPaidPlan ? DEFAULT_MODEL_PRO : DEFAULT_MODEL_FREE);
      if ('thinkingToggle' in defaultConfig) {
        setThinkingToggle(!!defaultConfig.thinkingToggle);
      }
    }
  }, [debug, defaultConfig, isOnPaidPlan, modelConfig, setModelKey, setThinkingToggle]);

  if (!modelConfig) {
    return {
      isOnPaidPlan,
      modelKey: DEFAULT_MODEL_FREE,
      setModelKey,
      modelConfig: defaultConfig,
      thinkingToggle,
      setThinkingToggle,
    };
  }

  return { isOnPaidPlan, modelKey, setModelKey, modelConfig, thinkingToggle, setThinkingToggle };
};
