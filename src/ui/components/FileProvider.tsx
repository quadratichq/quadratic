import mixpanel from 'mixpanel-browser';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router';
import { useSetRecoilState } from 'recoil';
import { isOwner as isOwnerTest } from '../../actions';
import { apiClient } from '../../api/apiClient';
import { editorInteractionStateAtom } from '../../atoms/editorInteractionStateAtom';
import { useFileRouteLoaderData } from '../../dashboard/FileRoute';
import { debugShowFileIO } from '../../debugFlags';
import { grid } from '../../grid/controller/Grid';
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
  syncState: Sync['state'];
};

/**
 * Context
 */
const FileContext = createContext<FileContextType>({} as FileContextType);

/**
 * Provider
 */
export const FileProvider = ({ children }: { children: React.ReactElement }) => {
  // We can guarantee this is in the URL when it runs, so cast as string
  const { uuid } = useParams() as { uuid: string };
  const initialFileData = useFileRouteLoaderData();
  const [name, setName] = useState<FileContextType['name']>(initialFileData.name);
  const [publicLinkAccess] = useState(initialFileData.sharing.public_link_access);
  let isFirstUpdate = useRef(true);
  const setEditorInteractionState = useSetRecoilState(editorInteractionStateAtom);
  const [latestSync, setLatestSync] = useState<Sync>({ id: 0, state: 'idle' });

  const syncState = latestSync.state;
  const isOwner = isOwnerTest(initialFileData.permission);

  const renameFile: FileContextType['renameFile'] = useCallback(
    (newName) => {
      mixpanel.track('[Files].renameCurrentFile', { newFilename: newName });
      setName(newName);
    },
    [setName]
  );

  // Create and save the fn used by the sheetController to save the file

  const syncChanges = useCallback(
    async (apiClientFn: Function) => {
      // User shouldn't have the ability to change anything, but we'll double
      // make sure the file can't be modified on the server if it's not the owner
      if (!isOwner) return;

      // Don't sync anything if we're on the first update
      if (isFirstUpdate.current) return;

      const id = Date.now();
      setLatestSync({ id, state: 'syncing' });
      apiClientFn()
        .then(() => true)
        .catch(() => false)
        .then((ok: boolean) => {
          setLatestSync((prev) => (prev.id === id ? { id, state: ok ? 'idle' : 'error' } : prev));
        });
    },
    [setLatestSync, isOwner]
  );

  // When the file name changes, update document title and sync to server
  useEffect(() => {
    document.title = `${name} - Quadratic`;
    syncChanges(() => apiClient.updateFile(uuid, { name }));
  }, [name, syncChanges, uuid]);

  // If a sync fails, start an interval that tries to sync everything about the
  // file anew every few seconds until a sync completes again
  useInterval(
    () => {
      // on error, attempt to resync everything
      if (syncState === 'error') {
        if (debugShowFileIO) console.log('[FileProvider] attempting to resync entire file after error...');
        syncChanges(() =>
          apiClient.updateFile(uuid, {
            name,
            contents: grid.export(),
            version: grid.getVersion(),
          })
        );
        apiClient.updateFileSharing(uuid, { public_link_access: publicLinkAccess });
        grid.dirty = false;
      } else if (grid.dirty) {
        if (debugShowFileIO) console.log('[FileProvider] saving file...');
        syncChanges(() => apiClient.updateFile(uuid, { contents: grid.export(), version: grid.getVersion() }));
        grid.dirty = false;
      }
    },
    syncState === 'error' ? syncErrorInterval : syncInterval
  );

  // Set the permission in recoil based on the initial state
  // TODO figure out a way to set this in RecoilRoot (if possible)
  //      or let it flow if we go with react-router's loaders for this
  useEffect(() => {
    setEditorInteractionState((prev) => ({ ...prev, permission: initialFileData.permission }));
  }, [initialFileData.permission, setEditorInteractionState]);

  // Keep track of lifecycle so we can run things at a specific time
  useEffect(() => {
    if (isFirstUpdate.current) {
      isFirstUpdate.current = false;
      return;
    }

    return () => {
      isFirstUpdate.current = true;
    };
  }, []);

  return (
    <FileContext.Provider
      value={{
        name,
        renameFile,
        syncState,
      }}
    >
      {children}
    </FileContext.Provider>
  );
};

/**
 * Consumer
 */
export const useFileContext = () => useContext(FileContext);
