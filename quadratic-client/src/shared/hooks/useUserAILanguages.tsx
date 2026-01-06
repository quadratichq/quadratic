import { apiClient } from '@/shared/api/apiClient';
import { atom, getDefaultStore, useAtom } from 'jotai';
import { useCallback } from 'react';

export interface AILanguages {
  formulas: boolean;
  python: boolean;
  javascript: boolean;
}

export const defaultAILanguages: AILanguages = {
  formulas: true,
  python: true,
  javascript: false,
};

// Atom for the AI languages state
export const aiLanguagesAtom = atom<AILanguages>(defaultAILanguages);

// Atom for loading state
export const aiLanguagesLoadingAtom = atom<boolean>(false);

// Track if initial load has happened
let hasLoaded = false;

/**
 * Preload user AI languages. Call this early in the app lifecycle to warm the cache.
 */
export function preloadUserAILanguages() {
  if (hasLoaded) return;
  hasLoaded = true;

  const store = getDefaultStore();
  store.set(aiLanguagesLoadingAtom, true);

  apiClient.user.aiLanguages
    .get()
    .then((response) => {
      store.set(aiLanguagesAtom, response.aiLanguages ?? defaultAILanguages);
    })
    .catch((error) => {
      console.error('Failed to preload AI languages:', error);
    })
    .finally(() => {
      store.set(aiLanguagesLoadingAtom, false);
    });
}

/**
 * Hook to get and manage user AI language preferences.
 */
export function useUserAILanguages() {
  const [aiLanguages, setAILanguages] = useAtom(aiLanguagesAtom);
  const [isLoading] = useAtom(aiLanguagesLoadingAtom);

  // Trigger initial load if not already done
  if (!hasLoaded) {
    preloadUserAILanguages();
  }

  const saveAILanguages = useCallback(
    async (newLanguages: AILanguages): Promise<boolean> => {
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
    isLoading,
    saveAILanguages,
  };
}
