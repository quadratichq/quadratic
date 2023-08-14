import { PostFileContentsReq, PostFileNameReq } from 'api-client/types';
import { useDebounce } from 'hooks/useDebounce';
import { useInterval } from 'hooks/useInterval';
import mixpanel from 'mixpanel-browser';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router';
import { InitialFile } from 'routes/file';
import { GridFile } from 'schemas';
import apiClientSingleton from '../../api-client/apiClientSingleton';
import { SheetController } from '../../grid/controller/sheetController';

type Sync = {
  id: number;
  state: 'idle' | 'syncing' | 'error';
};

export type FileContextType = {
  name: string;
  renameFile: (newName: string) => void;
  contents: GridFile;
  syncState: Sync['state'];
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
  const params = useParams();
  // We can gaurantee this is in the URL when it runs, so cast as string
  const uuid = params.uuid as string;
  const [name, setName] = useState<FileContextType['name']>(initialFile.name);
  const [contents, setContents] = useState<FileContextType['contents']>(initialFile.contents);
  const debouncedContents = useDebounce<FileContextType['contents']>(contents, 1000);
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

    // TODO when we do true spa transitions, we'll likely need to clear/rebuild/reset
    // sheetController.clear();
    sheetController.sheet.load_file(initialFile.contents);
    // sheetController.app?.rebuild();
    // sheetController.app?.reset();
  }, [sheetController.sheet, initialFile.contents]);

  // TODO debounce file changes so changes sync only every X milliseconds
  const syncChanges = useCallback(
    async (changes: PostFileContentsReq | PostFileNameReq) => {
      const id = Date.now();
      setLatestSync({ id, state: 'syncing' });
      const ok = await apiClientSingleton.postFile(uuid, changes);
      setLatestSync((prev) => (prev.id === id ? { id, state: ok ? 'idle' : 'error' } : prev));
    },
    [setLatestSync, uuid]
  );

  // When the file name changes, update document title and sync to server
  useEffect(() => {
    document.title = `${name} - Quadratic`;
    syncChanges({ name });
  }, [name, syncChanges, uuid]);

  // When the contents of the file changes, sync to server (debounce it so that
  // quick changes, especially undo/redos, don’t sync all at once)
  useEffect(() => {
    syncChanges({ contents: JSON.stringify(debouncedContents), version: debouncedContents.version });
  }, [debouncedContents, syncChanges]);

  // If a sync fails, start an interval that tries to sync anew ever few seconds
  // until a sync completes again
  useInterval(
    () => {
      syncChanges({ contents: JSON.stringify(debouncedContents), version: debouncedContents.version });
    },
    syncState === 'error' ? 1000 : null
  );

  return <FileContext.Provider value={{ name, renameFile, contents, syncState }}>{children}</FileContext.Provider>;
};

/**
 * Consumer
 */
export const useFile = () => useContext(FileContext);
