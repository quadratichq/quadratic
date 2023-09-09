import mixpanel from 'mixpanel-browser';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router';
import { apiClient } from '../../api/apiClient';
import { InitialFile } from '../../dashboard/FileRoute';
import { sheetController } from '../../grid/controller/SheetController';
import { useDebounce } from '../../hooks/useDebounce';
import { useInterval } from '../../hooks/useInterval';

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
  const debouncedContents = useDebounce<boolean>(dirtyFile, 1000);
  let didMount = useRef<boolean>(false);
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
  const save = useCallback(async (): Promise<void> => {
    setDirtyFile(true);
    console.log('[FileProvider] sheetController file marked as dirty');
  }, []);
  useEffect(() => {
    sheetController.save = save;
  }, [save]);

  // On mounting, load the sheet
  useEffect(() => {
    if (didMount.current) return;

    if (!sheetController.loadFile(initialFile.contents)) {
      console.log('[FileProvider] Failed to load file...');
    } else {
      didMount.current = true;
      console.log('[FileProvider] (re)loading file into the sheet...');
    }
  }, [initialFile.contents]);

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
  useEffect(() => {
    if (debouncedContents) {
      syncChanges(() =>
        apiClient.updateFile(uuid, { contents: sheetController.export(), version: sheetController.getVersion() })
      );
      setDirtyFile(false);
    }
  }, [debouncedContents, syncChanges, uuid]);

  // If a sync fails, start an interval that tries to sync anew ever few seconds
  // until a sync completes again
  useInterval(
    () => {
      syncChanges(() =>
        apiClient.updateFile(uuid, { contents: sheetController.export(), version: sheetController.getVersion() })
      );
    },
    syncState === 'error' ? 5000 : null
  );

  return <FileContext.Provider value={{ name, renameFile, syncState }}>{children}</FileContext.Provider>;
};

/**
 * Consumer
 */
export const useFileContext = () => useContext(FileContext);
