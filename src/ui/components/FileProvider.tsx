import mixpanel from 'mixpanel-browser';
import { Dispatch, SetStateAction, createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router';
import { useSetRecoilState } from 'recoil';
import { apiClient } from '../../api/apiClient';
import { editorInteractionStateAtom } from '../../atoms/editorInteractionStateAtom';
import { InitialFile } from '../../dashboard/FileRoute';
import { SheetController } from '../../grid/controller/sheetController';
import { downloadFileInBrowser } from '../../helpers/downloadFileInBrowser';
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
  downloadFile: () => void;
  publicLinkAccess: InitialFile['publicLinkAccess'];
  setPublicLinkAccess: Dispatch<SetStateAction<InitialFile['publicLinkAccess']>>;
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
  initialFile,
  sheetController,
}: {
  children: React.ReactElement;
  initialFile: InitialFile;
  sheetController: SheetController;
}) => {
  // We can gaurantee this is in the URL when it runs, so cast as string
  const { uuid } = useParams() as { uuid: string };
  const [name, setName] = useState<FileContextType['name']>(initialFile.name);
  const [contents, setContents] = useState<FileContextType['contents']>(initialFile.contents);
  const [publicLinkAccess, setPublicLinkAccess] = useState<FileContextType['publicLinkAccess']>(
    initialFile.publicLinkAccess
  );
  const debouncedContents = useDebounce<FileContextType['contents']>(contents, 1000);
  let didMount = useRef<boolean>(false);
  const setEditorInteractionState = useSetRecoilState(editorInteractionStateAtom);
  const [latestSync, setLatestSync] = useState<Sync>({ id: 0, state: 'idle' });

  const syncState = latestSync.state;
  const isOwner = initialFile.permission === 'OWNER';

  const renameFile: FileContextType['renameFile'] = useCallback(
    (newName) => {
      mixpanel.track('[Files].renameCurrentFile', { newFilename: newName });
      setName(newName);
    },
    [setName]
  );

  const downloadFile = useCallback(() => {
    downloadFileInBrowser(name, JSON.stringify(contents));
  }, [name, contents]);

  // Create and save the fn used by the sheetController to save the file
  const save = useCallback(async (): Promise<void> => {
    setContents((oldContents) => {
      let newContents = {
        ...oldContents,
        ...sheetController.sheet.export_file(),
      };
      return newContents;
    });

    console.log('[FileProvider] sheetController file save');
  }, [setContents, sheetController.sheet]);
  useEffect(() => {
    sheetController.saveFile = save;
  }, [sheetController, save]);

  // On mounting, load the sheet
  useEffect(() => {
    if (didMount.current) return;
    didMount.current = true;
    console.log('[FileProvider] (re)loading file into the sheet...');

    sheetController.sheet.load_file(initialFile.contents);
  }, [sheetController.sheet, initialFile.contents]);

  const syncChanges = useCallback(
    async (apiClientFn: Function) => {
      // User shouldn't have the ability to change anything, but we'll double
      // make sure the file can't be modified on the server if it's not the owner
      if (!isOwner) return;

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
          public_link_access: publicLinkAccess,
          name,
        })
      );
    },
    syncState === 'error' ? 5000 : null
  );

  // Update the public link access when it changes
  useEffect(() => {
    syncChanges(() => apiClient.updateFile(uuid, { public_link_access: publicLinkAccess }));
  }, [publicLinkAccess, syncChanges, uuid]);

  // Set the permission based on the initial state
  useEffect(() => {
    setEditorInteractionState((prev) => ({ ...prev, permission: initialFile.permission }));
  }, [initialFile.permission, setEditorInteractionState]);

  return (
    <FileContext.Provider
      value={{
        downloadFile,
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
