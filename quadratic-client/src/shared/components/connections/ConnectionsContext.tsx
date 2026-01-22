import { createContext, useContext, type ReactNode } from 'react';

interface ConnectionsContextValue {
  /** Skip Recoil state updates (useful when rendering outside of RecoilRoot) */
  skipRecoilUpdates: boolean;
}

const ConnectionsContext = createContext<ConnectionsContextValue>({
  skipRecoilUpdates: false,
});

export const useConnectionsContext = () => useContext(ConnectionsContext);

export const ConnectionsProvider = ({
  children,
  skipRecoilUpdates = false,
}: {
  children: ReactNode;
  skipRecoilUpdates?: boolean;
}) => {
  return <ConnectionsContext.Provider value={{ skipRecoilUpdates }}>{children}</ConnectionsContext.Provider>;
};
