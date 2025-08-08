import { hasPermissionToEditFile } from '@/app/actions';
import { editorInteractionStatePermissionsAtom } from '@/app/atoms/editorInteractionStateAtom';
import { apiClient } from '@/shared/api/apiClient';
import { useFileRouteLoaderData } from '@/shared/hooks/useFileRouteLoaderData';
import { trackEvent } from '@/shared/utils/analyticsEvents';
import { updateRecentFiles } from '@/shared/utils/updateRecentFiles';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router';
import { useSetRecoilState } from 'recoil';

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
  const [name, setName] = useState<FileContextType['name']>(initialFileData.file.name);
  let isFirstUpdate = useRef(true);
  const setPermissions = useSetRecoilState(editorInteractionStatePermissionsAtom);
  const [latestSync, setLatestSync] = useState<Sync>({ id: 0, state: 'idle' });

  const syncState = latestSync.state;
  const canEdit = hasPermissionToEditFile(initialFileData.userMakingRequest.filePermissions);

  const renameFile: FileContextType['renameFile'] = useCallback(
    (newName) => {
      trackEvent('[Files].renameCurrentFile', { newFilename: newName });
      setName(newName);
    },
    [setName]
  );

  // Create and save the fn used by the sheetController to save the file

  const syncChanges = useCallback(
    async (apiClientFn: Function) => {
      // User shouldn't have the ability to change anything, but we'll double
      // make sure the file can't be modified on the server if it's not the owner
      if (!canEdit) return;

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
    [setLatestSync, canEdit]
  );

  // When the file name changes, update document title and sync to server
  useEffect(() => {
    // todo: this isn't captured via the api.files.$uuid.ts endpoint
    updateRecentFiles(uuid, name, true);
    document.title = `${name} - Quadratic`;
    syncChanges(() => apiClient.files.update(uuid, { name }));
  }, [name, syncChanges, uuid]);

  // Set the permission in recoil based on the initial state
  // TODO figure out a way to set this in RecoilRoot (if possible)
  //      or let it flow if we go with react-router's loaders for this
  useEffect(() => {
    setPermissions(initialFileData.userMakingRequest.filePermissions);
  }, [initialFileData.userMakingRequest.filePermissions, setPermissions]);

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
