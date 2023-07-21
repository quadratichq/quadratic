import { createContext, useContext } from 'react';

export type File = {
  file: {
    id: string;
    filename: string;
    isReadOnly: boolean;
    isPublic: boolean;
  };
  setFile: any; // TODO
};

/**
 * Context
 */

export const LocalFilesContext = createContext<File>({} as File);

/**
 * Provider
 */

export const LocalFilesProvider = ({ children, value }: { children: React.ReactElement; value: File }) => {
  return <LocalFilesContext.Provider value={value}>{children}</LocalFilesContext.Provider>;
};

/**
 * Consumer
 */

export const useLocalFiles = () => useContext(LocalFilesContext);
