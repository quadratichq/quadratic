import { createContext, useContext, useState, ReactNode, useEffect, useCallback } from 'react';
type LoadingProviderProps = { children: ReactNode };

const LOAD_COUNT = 2;

export type LoadingContextType = {
  loading: boolean;
  incrementLoadingCount: () => void;
};

export const LoadingContext = createContext<LoadingContextType>({
  loading: true,
  incrementLoadingCount: () => console.warn('useLoading must be used within LoadingProvider'),
});

export function useLoading() {
  const context = useContext(LoadingContext);
  if (!context) {
    throw new Error('useLoading must be used within LoadingProvider');
  }
  return context;
}

export function LoadingProvider({ children }: LoadingProviderProps) {
  const [loading, setLoading] = useState(true);
  const [loadingCount, setLoadingCount] = useState(0);

  const incrementLoadingCount = useCallback(() => {
    setLoadingCount((count) => count + 1);
  }, [setLoadingCount]);

  const value = { loading, incrementLoadingCount };

  useEffect(() => {
    if (loadingCount === LOAD_COUNT) {
      setLoading(false);
    }
  }, [loadingCount]);

  return <LoadingContext.Provider value={value}>{children}</LoadingContext.Provider>;
}
