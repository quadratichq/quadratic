import useLocalStorage from '@/shared/hooks/useLocalStorage';

const initialState = { themeAppearanceMode: false, themeAccentColor: false };
export type FeatureFlagKey = keyof typeof initialState;

/**
 * Hook - this is how you should get the state of this provider
 */
export const useFeatureFlag = (key: FeatureFlagKey) => {
  const [state, setState] = useLocalStorage('featureFlags', initialState);

  const localState = state[key];
  const setLocalState = (value: boolean) => setState((prevState) => ({ ...prevState, [key]: value }));
  return [localState, setLocalState] as const;
};
