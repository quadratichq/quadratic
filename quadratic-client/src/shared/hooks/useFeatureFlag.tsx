import useLocalStorage from '@/shared/hooks/useLocalStorage';
import { trackEvent } from '@/shared/utils/analyticsEvents';

const initialState = {};
export type FeatureFlagKey = keyof typeof initialState;

export const useFeatureFlag = (key: FeatureFlagKey) => {
  const [state, setState] = useLocalStorage('featureFlags', initialState);

  const localState = state[key];
  const setLocalState = (value: boolean) => {
    if (value) {
      trackEvent('[FeatureFlag].on', { key });
    } else {
      trackEvent('[FeatureFlag].off', { key });
    }
    setState((prevState) => ({ ...prevState, [key]: value }));
  };
  return [localState, setLocalState] as const;
};
