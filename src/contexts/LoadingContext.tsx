import { createContext, useContext, useState, ReactNode } from "react";
type LoadingProviderProps = { children: ReactNode };

export type LoadingContextType = {
  loading: boolean;
  setLoading: (loading: boolean) => void;
};

export const LoadingContext = createContext<LoadingContextType>({
  loading: true,
  setLoading: (loading) =>
    console.warn("useLoading must be used within LoadingProvider1"),
});
export function useLoading() {
  const context = useContext(LoadingContext);
  if (!context) {
    throw new Error("useLoading must be used within LoadingProvider");
  }
  return context;
}

export function LoadingProvider({ children }: LoadingProviderProps) {
  const [loading, setLoading] = useState(true);
  const value = { loading, setLoading };

  // Super Hacky Way To Set Loading...
  setTimeout(() => {
    setLoading(false);
  }, 4000);

  return (
    <LoadingContext.Provider value={value}>{children}</LoadingContext.Provider>
  );
}
