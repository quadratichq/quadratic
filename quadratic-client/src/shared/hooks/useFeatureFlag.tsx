import useLocalStorage from '@/shared/hooks/useLocalStorage';

const initialState = { themeAppearanceMode: false, themeAccentColor: false };
export type FeatureFlagKey = keyof typeof initialState;

export const useFeatureFlag = (key: FeatureFlagKey) => {
  const [state, setState] = useLocalStorage('featureFlags', initialState);

  const localState = state[key];
  const setLocalState = (value: boolean) => setState((prevState) => ({ ...prevState, [key]: value }));
  return [localState, setLocalState] as const;
};
