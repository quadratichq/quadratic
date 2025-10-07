import { useDebugFlags } from '@/app/debugFlags/useDebugFlags';
import { useIsOnPaidPlan } from '@/app/ui/hooks/useIsOnPaidPlan';
import useLocalStorage, { type SetValue } from '@/shared/hooks/useLocalStorage';
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
  setModelType: SetValue<MODEL_TYPE>;

  SetModelOthers: SetValue<AIModelKey>;
  othersModel: AIModelKey | undefined;
}

export const useAIModel = (): UseAIModelReturn => {
  const { isOnPaidPlan } = useIsOnPaidPlan();
  const { debug } = useDebugFlags();

  const [modelType, setModelType] = useLocalStorage<MODEL_TYPE>(AI_MODEL_TYPE_KEY, 'default');
  const [othersModel, setOthersModel] = useLocalStorage<AIModelKey | undefined>(AI_MODEL_OTHERS_KEY, undefined);

  const modelKey = useMemo(() => {
    if (modelType === 'default') {
      const fast = Object.keys(MODELS_CONFIGURATION).find(
        (key) => MODELS_CONFIGURATION[key as AIModelKey].mode === 'fast'
      );
      if (!fast) throw new Error('Fast model not found');
      return fast as AIModelKey;
    }
    if (modelType === 'max') {
      const max = Object.keys(MODELS_CONFIGURATION).find(
        (key) => MODELS_CONFIGURATION[key as AIModelKey].mode === 'max'
      );
      if (!max) throw new Error('Max model not found');
      return max as AIModelKey;
    }
    if (modelType === 'others') {
      if (!othersModel) throw new Error('Others model not found');
      return othersModel;
    }
    return modelType;
  }, [modelType, othersModel]);

  useEffect(() => {
    if (debug) return;

    // ensure the selected model is still available; otherwise set to default
    if (modelType !== 'default' && modelType !== 'max') {
      const modelConfig = MODELS_CONFIGURATION[modelType as AIModelKey];
      if (modelConfig.mode === 'disabled') {
        setModelType('default');
      }
    }
  }, [debug, modelType, setModelType]);

  const setModel = useCallback(
    (modelType: MODEL_TYPE, othersKey?: AIModelKey) => {
      if (modelType === 'others') {
        if (!othersKey) throw new Error('Others model not found');
        setOthersModel(othersKey);
      }
      setModelType(modelType);
    },
    [setModelType, setOthersModel]
  );

  return {
    isOnPaidPlan,
    modelKey,
    modelType,
    setModelType,
    selectedModelConfig: MODELS_CONFIGURATION[modelKey],
    setModel,
    othersModel,
    setOthersModel,
  };
};
