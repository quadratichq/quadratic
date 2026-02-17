import { authClient } from '@/auth/auth';
import { apiClient } from '@/shared/api/apiClient';
import { atom, getDefaultStore, useAtom } from 'jotai';
import { type AILanguagePreferences } from 'quadratic-shared/typesAndSchemasAI';
import { useCallback, useEffect } from 'react';

// Atom for the AI languages state
export const aiLanguagesAtom = atom<AILanguagePreferences>([]);

// Internal load state (using atom for testability/HMR)
type LoadState = 'idle' | 'loading' | 'loaded' | 'error';
const loadStateAtom = atom<LoadState>('idle');

/**
 * Hook to get and manage user AI language preferences.
 */
export function useUserAILanguages() {
  const [aiLanguages, setAILanguages] = useAtom(aiLanguagesAtom);

  // Trigger initial load if not already started
  useEffect(() => {
    preloadUserAILanguages();
  }, []);

  const saveAILanguages = useCallback(
    async (newLanguages: AILanguagePreferences): Promise<boolean> => {
      // Optimistically update
      const previousValue = aiLanguages;
      setAILanguages(newLanguages);

      try {
        const response = await apiClient.user.aiLanguages.update({ aiLanguages: newLanguages });
        setAILanguages(response.aiLanguages);
        return true;
      } catch (error) {
        console.error('Failed to save AI languages:', error);
        // Revert on error
        setAILanguages(previousValue);
        return false;
      }
    },
    [aiLanguages, setAILanguages]
  );

  return {
    aiLanguages,
    saveAILanguages,
  };
}

/**
 * Preload user AI languages. Call this early in the app lifecycle to warm the cache.
 */
export function preloadUserAILanguages() {
  const store = getDefaultStore();
  const loadState = store.get(loadStateAtom);

  if (loadState === 'idle') {
    store.set(loadStateAtom, 'loading');

    authClient
      .isAuthenticated()
      .then((isAuthenticated) => {
        if (!isAuthenticated) {
          store.set(loadStateAtom, 'idle');
          return;
        }

        return apiClient.user.aiLanguages
          .get()
          .then((response) => {
            store.set(aiLanguagesAtom, response.aiLanguages);
            store.set(loadStateAtom, 'loaded');
          });
      })
      .catch((error) => {
        console.error('Failed to preload AI languages:', error);
        store.set(loadStateAtom, 'error');
      });
  }
}
