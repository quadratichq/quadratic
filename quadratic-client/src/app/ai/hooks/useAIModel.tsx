import { useDebugFlags } from '@/app/debugFlags/useDebugFlags';
import { useIsOnPaidPlan } from '@/app/ui/hooks/useIsOnPaidPlan';
import useLocalStorage from '@/shared/hooks/useLocalStorage';
import { MODELS_CONFIGURATION } from 'quadratic-shared/ai/models/AI_MODELS';
import type { AIModelConfig, AIModelKey } from 'quadratic-shared/typesAndSchemasAI';
import { useCallback, useEffect, useMemo } from 'react';

const AI_MODEL_TYPE_KEY = 'aiModelTypeKey';
const AI_MODEL_OTHERS_KEY = 'aiModelOthersKey';

export type MODEL_TYPE = 'default' | 'max' | 'others';

interface UseAIModelReturn {
  isOnPaidPlan: boolean;

  modelKey: AIModelKey;
  selectedModelConfig: AIModelConfig;

  modelType: MODEL_TYPE;
  othersModelKey: AIModelKey | undefined;
  setModel: (modelType: MODEL_TYPE, othersModel?: AIModelKey) => void;

  defaultOthersModelKey: AIModelKey;
}

export const useAIModel = (): UseAIModelReturn => {
  const { isOnPaidPlan } = useIsOnPaidPlan();
  const { debug } = useDebugFlags();

  const [modelType, setModelType] = useLocalStorage<MODEL_TYPE>(AI_MODEL_TYPE_KEY, 'default');
  const [othersModelKey, setOthersModelKey] = useLocalStorage<AIModelKey | undefined>(AI_MODEL_OTHERS_KEY, undefined);

  const othersModelKeys: AIModelKey[] = useMemo(() => {
    return Object.keys(MODELS_CONFIGURATION).filter((key) => {
      return MODELS_CONFIGURATION[key as AIModelKey].mode === 'others';
    }) as AIModelKey[];
  }, []);

  const defaultOthersModelKey: AIModelKey = useMemo(() => {
    if (!othersModelKeys.length) throw new Error('Others model not found');
    return othersModelKeys[0];
  }, [othersModelKeys]);

  const defaultModelKey: AIModelKey = useMemo(() => {
    const key = Object.keys(MODELS_CONFIGURATION).find(
      (key) => MODELS_CONFIGURATION[key as AIModelKey].mode === 'fast'
    );
    if (!key) throw new Error('Default model not found');
    return key as AIModelKey;
  }, []);

  const maxModelKey: AIModelKey = useMemo(() => {
    const key = Object.keys(MODELS_CONFIGURATION).find((key) => MODELS_CONFIGURATION[key as AIModelKey].mode === 'max');
    if (!key) throw new Error('Default model not found');
    return key as AIModelKey;
  }, []);

  const modelKey = useMemo(() => {
    if (modelType === 'others') {
      if (othersModelKey) {
        return othersModelKey;
      }
      setModelType('default');
      return defaultOthersModelKey;
    }
    if (modelType === 'default') {
      return defaultModelKey;
    }
    if (modelType === 'max') {
      return maxModelKey;
    }
    return modelType;
  }, [defaultModelKey, defaultOthersModelKey, maxModelKey, modelType, othersModelKey, setModelType]);

  useEffect(() => {
    if (debug) return;

    // ensure the selected model is still available; otherwise set to default
    if (modelType === 'others' && othersModelKey) {
      const modelConfig = MODELS_CONFIGURATION[othersModelKey];
      if (!modelConfig || modelConfig.mode === 'disabled') {
        setModelType('default');
      }
    } else if (modelType === 'others') {
      setModelType('default');
    }
  }, [debug, modelType, setModelType, othersModelKey]);

  const setModel = useCallback(
    (modelType: MODEL_TYPE, othersKey?: AIModelKey) => {
      if (modelType === 'others') {
        if (!othersKey) throw new Error('Others model not found');
        setOthersModelKey(othersKey);
      }
      setModelType(modelType);
    },
    [setModelType, setOthersModelKey]
  );

  return {
    isOnPaidPlan,
    modelKey,
    modelType,
    othersModelKey,
    selectedModelConfig: MODELS_CONFIGURATION[modelKey],
    setModel,
    defaultOthersModelKey,
  };
};
