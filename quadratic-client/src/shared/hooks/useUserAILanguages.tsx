import { apiClient } from '@/shared/api/apiClient';
import { useCallback, useEffect, useRef, useState } from 'react';

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

// Global cache for AI languages - shared across all hook instances
let globalAILanguagesCache: AILanguages = defaultAILanguages;
let globalAILanguagesLoaded = false;
let globalAILanguagesLoading = false;
const globalAILanguagesListeners: Set<() => void> = new Set();

function notifyListeners() {
  globalAILanguagesListeners.forEach((listener) => listener());
}

function updateGlobalCache(value: AILanguages) {
  globalAILanguagesCache = value;
  notifyListeners();
}

/**
 * Hook to get and manage user AI language preferences.
 * Preloads AI languages on first use and caches them globally.
 */
export function useUserAILanguages() {
  const [, forceUpdate] = useState({});
  const isMountedRef = useRef(true);

  // Subscribe to global cache updates
  useEffect(() => {
    isMountedRef.current = true;
    const listener = () => {
      if (isMountedRef.current) {
        forceUpdate({});
      }
    };
    globalAILanguagesListeners.add(listener);

    // Load AI languages if not already loaded or loading
    if (!globalAILanguagesLoaded && !globalAILanguagesLoading) {
      globalAILanguagesLoading = true;
      apiClient.user.aiLanguages
        .get()
        .then((response) => {
          globalAILanguagesCache = response.aiLanguages ?? defaultAILanguages;
          globalAILanguagesLoaded = true;
          globalAILanguagesLoading = false;
          notifyListeners();
        })
        .catch((error) => {
          console.error('Failed to preload AI languages:', error);
          globalAILanguagesLoading = false;
          globalAILanguagesLoaded = true; // Mark as loaded even on error to prevent infinite retries
          notifyListeners();
        });
    }

    return () => {
      isMountedRef.current = false;
      globalAILanguagesListeners.delete(listener);
    };
  }, []);

  // Save function that updates the cache
  const saveAILanguages = useCallback(async (newLanguages: AILanguages): Promise<boolean> => {
    // Optimistically update the cache
    const previousValue = globalAILanguagesCache;
    updateGlobalCache(newLanguages);

    try {
      const response = await apiClient.user.aiLanguages.update({ aiLanguages: newLanguages });
      updateGlobalCache(response.aiLanguages);
      return true;
    } catch (error) {
      console.error('Failed to save AI languages:', error);
      // Revert to previous value on error
      updateGlobalCache(previousValue);
      return false;
    }
  }, []);

  return {
    aiLanguages: globalAILanguagesCache,
    isLoading: !globalAILanguagesLoaded,
    saveAILanguages,
  };
}

/**
 * Preload user AI languages. Call this early in the app lifecycle to warm the cache.
 */
export function preloadUserAILanguages() {
  if (!globalAILanguagesLoaded && !globalAILanguagesLoading) {
    globalAILanguagesLoading = true;
    apiClient.user.aiLanguages
      .get()
      .then((response) => {
        globalAILanguagesCache = response.aiLanguages ?? defaultAILanguages;
        globalAILanguagesLoaded = true;
        globalAILanguagesLoading = false;
        notifyListeners();
      })
      .catch((error) => {
        console.error('Failed to preload AI languages:', error);
        globalAILanguagesLoading = false;
        globalAILanguagesLoaded = true;
        notifyListeners();
      });
  }
}
