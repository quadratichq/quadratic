import useLocalStorage from '@/shared/hooks/useLocalStorage';
import mixpanel from 'mixpanel-browser';

const initialState = { themeAppearanceMode: false, themeAccentColor: false };
export type FeatureFlagKey = keyof typeof initialState;

export const useFeatureFlag = (key: FeatureFlagKey) => {
  const [state, setState] = useLocalStorage('featureFlags', initialState);

  const localState = state[key];
  const setLocalState = (value: boolean) => {
    if (value) {
      mixpanel.track('[FeatureFlag].on', { key });
    } else {
      mixpanel.track('[FeatureFlag].off', { key });
    }
    setState((prevState) => ({ ...prevState, [key]: value }));
  };
  return [localState, setLocalState] as const;
};
