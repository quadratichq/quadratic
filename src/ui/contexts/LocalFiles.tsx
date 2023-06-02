import { createContext, useContext } from 'react';
import { LocalFiles } from '../../hooks/useGenerateLocalFiles';

export type { LocalFiles };

/**
 * Context
 */

export const LocalFilesContext = createContext<LocalFiles>({} as LocalFiles);

/**
 * Provider
 */

export const LocalFilesProvider = ({
  children,
  localFiles,
}: {
  children: React.ReactElement;
  localFiles: LocalFiles;
}) => {
  return <LocalFilesContext.Provider value={localFiles}>{children}</LocalFilesContext.Provider>;
};

/**
 * Consumer
 */

export const useLocalFiles = () => useContext(LocalFilesContext);
