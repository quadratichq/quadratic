import mixpanel from 'mixpanel-browser';
import { Dispatch, SetStateAction, createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router';
import { useSetRecoilState } from 'recoil';
import { isOwner as isOwnerTest } from '../../actions';
import { apiClient } from '../../api/apiClient';
import { editorInteractionStateAtom } from '../../atoms/editorInteractionStateAtom';
import { FileData, useFileRouteLoaderData } from '../../dashboard/FileRoute';
import { SheetController } from '../../grid/controller/sheetController';
import { useDebounce } from '../../hooks/useDebounce';
import { useInterval } from '../../hooks/useInterval';
import { GridFile } from '../../schemas';

type Sync = {
  id: number;
  state: 'idle' | 'syncing' | 'error';
};

export type FileContextType = {
  name: string;
  renameFile: (newName: string) => void;
  contents: GridFile;
  syncState: Sync['state'];
  publicLinkAccess: FileData['sharing']['public_link_access'];
  setPublicLinkAccess: Dispatch<SetStateAction<FileData['sharing']['public_link_access']>>;
};

/**
 * Context
 */
const FileContext = createContext<FileContextType>({} as FileContextType);

/**
 * Provider
 */
export const FileProvider = ({
  children,
  sheetController,
}: {
  children: React.ReactElement;
  sheetController: SheetController;
}) => {
  // We can gaurantee this is in the URL when it runs, so cast as string
  const { uuid } = useParams() as { uuid: string };
  const initialFileData = useFileRouteLoaderData();
  const [name, setName] = useState<FileContextType['name']>(initialFileData.name);
  const [contents, setContents] = useState<FileContextType['contents']>(initialFileData.contents);
  const [publicLinkAccess, setPublicLinkAccess] = useState<FileContextType['publicLinkAccess']>(
    initialFileData.sharing.public_link_access
  );
  const debouncedContents = useDebounce<FileContextType['contents']>(contents, 1000);
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
  const save = useCallback(async (): Promise<void> => {
    setContents((oldContents) => {
      let newContents = {
        ...oldContents,
        ...sheetController.sheet.export_file(),
      };
      return newContents;
    });
  }, [setContents, sheetController.sheet]);
  useEffect(() => {
    sheetController.saveFile = save;
  }, [sheetController, save]);

  // On mounting, load the sheet
  useEffect(() => {
    if (isFirstUpdate.current) {
      sheetController.sheet.load_file(initialFileData.contents);
    }
  }, [sheetController.sheet, initialFileData.contents]);

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

  // When the contents of the file changes, sync to server (debounce it so that
  // quick changes, especially undo/redos, don’t sync all at once)
  useEffect(() => {
    syncChanges(() =>
      apiClient.updateFile(uuid, { contents: JSON.stringify(debouncedContents), version: debouncedContents.version })
    );
  }, [debouncedContents, syncChanges, uuid]);

  // If a sync fails, start an interval that tries to sync everything about the
  // file anew every few seconds until a sync completes again
  useInterval(
    () => {
      syncChanges(() =>
        apiClient.updateFile(uuid, {
          contents: JSON.stringify(debouncedContents),
          version: debouncedContents.version,
          name,
        })
      );
      syncChanges(() => apiClient.updateFileSharing(uuid, { public_link_access: publicLinkAccess }));
    },
    syncState === 'error' ? 5000 : null
  );

  // Update the public link access when it changes
  useEffect(() => {
    syncChanges(() => apiClient.updateFileSharing(uuid, { public_link_access: publicLinkAccess }));
  }, [publicLinkAccess, syncChanges, uuid]);

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
        contents,
        syncState,
        publicLinkAccess,
        setPublicLinkAccess,
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
