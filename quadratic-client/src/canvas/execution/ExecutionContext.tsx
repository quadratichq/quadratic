/**
 * Context for exposing execution functions to node components.
 */

import { createContext, useContext, type ReactNode } from 'react';

interface ExecutionContextValue {
  executeCodeNode: (nodeId: string) => void;
}

const ExecutionContext = createContext<ExecutionContextValue | null>(null);

interface ExecutionProviderProps {
  children: ReactNode;
  executeCodeNode: (nodeId: string) => void;
}

export function ExecutionProvider({ children, executeCodeNode }: ExecutionProviderProps) {
  return <ExecutionContext.Provider value={{ executeCodeNode }}>{children}</ExecutionContext.Provider>;
}

export function useExecution() {
  const context = useContext(ExecutionContext);
  if (!context) {
    throw new Error('useExecution must be used within an ExecutionProvider');
  }
  return context;
}
