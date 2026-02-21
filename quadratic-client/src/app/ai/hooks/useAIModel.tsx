import { useDebugFlags } from '@/app/debugFlags/useDebugFlags';
import { teamBillingAtom } from '@/shared/atom/teamBillingAtom';
import useLocalStorage from '@/shared/hooks/useLocalStorage';
import { useAtomValue } from 'jotai';
import { MODELS_CONFIGURATION } from 'quadratic-shared/ai/models/AI_MODELS';
import type { AIModelConfig, AIModelKey } from 'quadratic-shared/typesAndSchemasAI';
import { useCallback, useEffect, useMemo } from 'react';

const AI_MODEL_TYPE_KEY = 'aiModelTypeKey';
const AI_MODEL_OTHERS_KEY = 'aiModelOthersKey';

// Note: 'default' is kept for backwards compatibility with users who had 'fast' selected.
// They will be migrated to 'max' in the useEffect below.
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
  const { isOnPaidPlan } = useAtomValue(teamBillingAtom);
  const { debug } = useDebugFlags();

  const [modelType, setModelType] = useLocalStorage<MODEL_TYPE>(AI_MODEL_TYPE_KEY, 'max');
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

  const maxModelKey: AIModelKey = useMemo(() => {
    const key = Object.keys(MODELS_CONFIGURATION).find((key) => MODELS_CONFIGURATION[key as AIModelKey].mode === 'max');
    if (!key) throw new Error('Max model not found');
    return key as AIModelKey;
  }, []);

  const modelKey = useMemo(() => {
    if (modelType === 'others') {
      // Validate that othersModelKey exists and is a valid model in configuration
      if (othersModelKey && MODELS_CONFIGURATION[othersModelKey]) {
        return othersModelKey;
      }
      // Invalid or missing othersModelKey, fallback to max (useEffect will fix localStorage)
      return maxModelKey;
    }
    // 'default' users (previously 'fast') are now treated as 'max'
    if (modelType === 'default' || modelType === 'max') {
      return maxModelKey;
    }
    // Fallback for any invalid/corrupted modelType value in localStorage
    return maxModelKey;
  }, [maxModelKey, modelType, othersModelKey]);

  useEffect(() => {
    if (debug) return;

    // Migrate users who had 'default' (fast) selected to 'max' (recommended)
    if (modelType === 'default') {
      setModelType('max');
      return;
    }

    // Handle invalid/corrupted modelType values in localStorage
    if (modelType !== 'max' && modelType !== 'others') {
      setModelType('max');
      return;
    }

    // ensure the selected model is still available; otherwise set to max
    if (modelType === 'others' && othersModelKey) {
      const modelConfig = MODELS_CONFIGURATION[othersModelKey];
      if (!modelConfig || modelConfig.mode === 'disabled') {
        setModelType('max');
      }
    } else if (modelType === 'others') {
      setModelType('max');
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
