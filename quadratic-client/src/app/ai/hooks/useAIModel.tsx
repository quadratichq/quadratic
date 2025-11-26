import { useDebugFlags } from '@/app/debugFlags/useDebugFlags';
import { useIsOnPaidPlan } from '@/app/ui/hooks/useIsOnPaidPlan';
import useLocalStorage from '@/shared/hooks/useLocalStorage';
import { MODELS_CONFIGURATION } from 'quadratic-shared/ai/models/AI_MODELS';
import type { AIModelConfig, AIModelKey } from 'quadratic-shared/typesAndSchemasAI';
import { useCallback, useEffect, useMemo } from 'react';

const AI_MODEL_TYPE_KEY = 'aiModelTypeKey';
const AI_MODEL_OTHERS_KEY = 'aiModelOthersKey';

export type MODEL_TYPE = 'default' | 'auto' | 'max' | 'others';

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

  const [modelTypeRaw, setModelTypeRaw] = useLocalStorage<MODEL_TYPE | 'max_plus'>(AI_MODEL_TYPE_KEY, 'auto');
  
  // Migrate old model types: 'max' -> 'auto', 'max_plus' -> 'max'
  useEffect(() => {
    if (modelTypeRaw === 'max') {
      // Old 'max' becomes 'auto'
      setModelTypeRaw('auto');
    } else if (modelTypeRaw === 'max_plus') {
      // Old 'max_plus' becomes 'max'
      setModelTypeRaw('max');
    }
  }, [modelTypeRaw, setModelTypeRaw]);

  const modelType = (modelTypeRaw === 'max_plus' ? 'max' : modelTypeRaw) as MODEL_TYPE;
  const setModelType = setModelTypeRaw as (value: MODEL_TYPE) => void;
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

  const autoModelKey: AIModelKey = useMemo(() => {
    const key = Object.keys(MODELS_CONFIGURATION).find((key) => MODELS_CONFIGURATION[key as AIModelKey].mode === 'auto');
    if (!key) throw new Error('Auto model not found');
    return key as AIModelKey;
  }, []);

  const maxModelKey: AIModelKey = useMemo(() => {
    const key = Object.keys(MODELS_CONFIGURATION).find((key) => MODELS_CONFIGURATION[key as AIModelKey].mode === 'max');
    if (!key) throw new Error('Max model not found');
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
    if (modelType === 'auto') {
      return autoModelKey;
    }
    if (modelType === 'max') {
      return maxModelKey;
    }
    return modelType;
  }, [defaultModelKey, defaultOthersModelKey, autoModelKey, maxModelKey, modelType, othersModelKey, setModelType]);

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

    // max is Pro-only, fall back to auto if not on paid plan
    if (modelType === 'max' && !isOnPaidPlan) {
      setModelType('auto');
    }
  }, [debug, isOnPaidPlan, modelType, setModelType, othersModelKey]);

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
