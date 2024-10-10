import useLocalStorage from '@/shared/hooks/useLocalStorage';
import { createContext, Dispatch, SetStateAction, useContext } from 'react';

const initialState = { themeAppearanceMode: false, themeAccentColor: false };

export type FeatureFlagKey = keyof typeof initialState;

/**
 * Context
 */
const FeatureFlagsContext = createContext<
  [Record<FeatureFlagKey, boolean>, Dispatch<SetStateAction<Record<FeatureFlagKey, boolean>>>]
>([initialState, () => {}]);

/**
 * Hook - this is how you should get the state of this provider
 */
export const useFeatureFlag = (key: FeatureFlagKey) => {
  const [state, setState] = useContext(FeatureFlagsContext);
  const localState = state[key];
  const localSetState = (value: boolean) => setState((prevState) => ({ ...prevState, [key]: value }));
  return [localState, localSetState] as const;
};

/**
 * Component
 */
export function FeatureFlags({ children }: { children: React.ReactNode }) {
  const [state, setState] = useLocalStorage('labs', initialState);

  return <FeatureFlagsContext.Provider value={[state, setState]}>{children}</FeatureFlagsContext.Provider>;
}
