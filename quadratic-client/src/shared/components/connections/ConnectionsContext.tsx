import { createContext, useContext, type ReactNode } from 'react';

interface ConnectionsContextValue {
  sshPublicKey: string;
}

const ConnectionsContext = createContext<ConnectionsContextValue>({
  sshPublicKey: '',
});

export const useConnectionsContext = () => useContext(ConnectionsContext);

export const ConnectionsProvider = ({ children, sshPublicKey }: { children: ReactNode; sshPublicKey: string }) => {
  return <ConnectionsContext.Provider value={{ sshPublicKey }}>{children}</ConnectionsContext.Provider>;
};
