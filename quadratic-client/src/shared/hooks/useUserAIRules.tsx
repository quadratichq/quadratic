import { authClient } from '@/auth/auth';
import { apiClient } from '@/shared/api/apiClient';
import { useCallback, useEffect, useRef, useState } from 'react';

// Global cache for AI rules - shared across all hook instances
let globalAIRulesCache: string | null = null;
let globalAIRulesLoaded = false;
let globalAIRulesLoading = false;
const globalAIRulesListeners: Set<() => void> = new Set();

function notifyListeners() {
  globalAIRulesListeners.forEach((listener) => listener());
}

function updateGlobalCache(value: string | null) {
  globalAIRulesCache = value;
  notifyListeners();
}

/**
 * Hook to get and manage user AI rules.
 * Preloads AI rules on first use and caches them globally.
 */
export function useUserAIRules() {
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
    globalAIRulesListeners.add(listener);

    // Load AI rules if not already loaded or loading
    if (!globalAIRulesLoaded && !globalAIRulesLoading) {
      globalAIRulesLoading = true;
      authClient
        .isAuthenticated()
        .then((isAuthenticated) => {
          if (!isAuthenticated) {
            globalAIRulesLoading = false;
            return;
          }

          return apiClient.user.aiRules
            .get()
            .then((response) => {
              globalAIRulesCache = response.aiRules ?? null;
              globalAIRulesLoaded = true;
              globalAIRulesLoading = false;
              notifyListeners();
            });
        })
        .catch((error) => {
          console.error('Failed to preload AI rules:', error);
          globalAIRulesLoading = false;
          globalAIRulesLoaded = true;
          notifyListeners();
        });
    }

    return () => {
      isMountedRef.current = false;
      globalAIRulesListeners.delete(listener);
    };
  }, []);

  // Save function that updates the cache
  const saveAIRules = useCallback(async (newRules: string | null): Promise<boolean> => {
    try {
      const response = await apiClient.user.aiRules.update({ aiRules: newRules });
      updateGlobalCache(response.aiRules ?? null);
      return true;
    } catch (error) {
      console.error('Failed to save AI rules:', error);
      return false;
    }
  }, []);

  return {
    aiRules: globalAIRulesCache ?? '',
    isLoading: !globalAIRulesLoaded,
    saveAIRules,
  };
}

/**
 * Preload user AI rules. Call this early in the app lifecycle to warm the cache.
 */
export function preloadUserAIRules() {
  if (!globalAIRulesLoaded && !globalAIRulesLoading) {
    globalAIRulesLoading = true;
    authClient
      .isAuthenticated()
      .then((isAuthenticated) => {
        if (!isAuthenticated) {
          globalAIRulesLoading = false;
          return;
        }

        return apiClient.user.aiRules
          .get()
          .then((response) => {
            globalAIRulesCache = response.aiRules ?? null;
            globalAIRulesLoaded = true;
            globalAIRulesLoading = false;
            notifyListeners();
          });
      })
      .catch((error) => {
        console.error('Failed to preload AI rules:', error);
        globalAIRulesLoading = false;
        globalAIRulesLoaded = true;
        notifyListeners();
      });
  }
}
