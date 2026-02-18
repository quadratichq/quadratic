import { createContext, useContext, type ReactNode } from 'react';

interface ConnectionsContextValue {
  sshPublicKey: string;
  staticIps: string[];
}

const ConnectionsContext = createContext<ConnectionsContextValue>({
  sshPublicKey: '',
  staticIps: [],
});

export const useConnectionsContext = () => useContext(ConnectionsContext);

export const ConnectionsProvider = ({
  children,
  sshPublicKey,
  staticIps,
}: {
  children: ReactNode;
  sshPublicKey: string;
  staticIps: string[];
}) => {
  return <ConnectionsContext.Provider value={{ sshPublicKey, staticIps }}>{children}</ConnectionsContext.Provider>;
};
