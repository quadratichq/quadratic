import mixpanel from 'mixpanel-browser';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useParams } from 'react-router';
import { apiClient } from '../../api/apiClient';
import { InitialFile } from '../../dashboard/FileRoute';
import { debugShowFileIO } from '../../debugFlags';
import { sheetController } from '../../grid/controller/SheetController';
import { useInterval } from '../../hooks/useInterval';

const syncInterval = 500;
const syncErrorInterval = 1000;

type Sync = {
  id: number;
  state: 'idle' | 'syncing' | 'error';
};

export type FileContextType = {
  name: string;
  renameFile: (newName: string) => void;
  // contents: GridFile;
  syncState: Sync['state'];
};

/**
 * Context
 */
const FileContext = createContext<FileContextType>({} as FileContextType);

/**
 * Provider
 */
export const FileProvider = ({ children, initialFile }: { children: React.ReactElement; initialFile: InitialFile }) => {
  const params = useParams();
  // We can guarantee this is in the URL when it runs, so cast as string
  const uuid = params.uuid as string;
  const [name, setName] = useState<FileContextType['name']>(initialFile.name);
  const [dirtyFile, setDirtyFile] = useState<boolean>(false);
  const [latestSync, setLatestSync] = useState<Sync>({ id: 0, state: 'idle' });
  const syncState = latestSync.state;

  const renameFile: FileContextType['renameFile'] = useCallback(
    (newName) => {
      mixpanel.track('[Files].renameCurrentFile', { newFilename: newName });
      setName(newName);
    },
    [setName]
  );

  // Create and save the fn used by the sheetController to save the file
  const save = useCallback(() => setDirtyFile(true), []);
  useEffect(() => {
    sheetController.save = save;
  }, [save]);

  const syncChanges = useCallback(
    async (apiClientFn: Function) => {
      const id = Date.now();
      setLatestSync({ id, state: 'syncing' });
      apiClientFn()
        .then(() => true)
        .catch(() => false)
        .then((ok: boolean) => {
          setLatestSync((prev) => (prev.id === id ? { id, state: ok ? 'idle' : 'error' } : prev));
        });
    },
    [setLatestSync]
  );

  // When the file name changes, update document title and sync to server
  useEffect(() => {
    document.title = `${name} - Quadratic`;
    syncChanges(() => apiClient.renameFile(uuid, { name }));
  }, [name, syncChanges, uuid]);

  // When the contents of the file changes, sync to server (debounce it so that
  // quick changes, especially undo/redos, don’t sync all at once)
  // If a sync fails, start an interval that tries to sync anew ever few seconds
  // until a sync completes again
  useInterval(
    () => {
      if (dirtyFile) {
        if (debugShowFileIO) console.log('[FileProvider] sheetController saving file...');
        syncChanges(() =>
          apiClient.updateFile(uuid, { contents: sheetController.export(), version: sheetController.getVersion() })
        );
        setDirtyFile(false);
      }
    },
    syncState === 'error' ? syncErrorInterval : syncInterval
  );

  return <FileContext.Provider value={{ name, renameFile, syncState }}>{children}</FileContext.Provider>;
};

/**
 * Consumer
 */
export const useFileContext = () => useContext(FileContext);
