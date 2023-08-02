import mixpanel from 'mixpanel-browser';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router';
import { GridFile } from 'schemas';
import apiClientSingleton from '../../api-client/apiClientSingleton';
import { GetFileClientRes } from '../../api-client/types';
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
  fileFromServer,
  sheetController,
}: {
  children: React.ReactElement;
  fileFromServer: GetFileClientRes;
  sheetController: SheetController;
}) => {
  const { uuid } = useParams();
  const [name, setName] = useState<FileContextType['name']>(fileFromServer.name);
  const [contents, setContents] = useState<FileContextType['contents']>(fileFromServer.contents);
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
    setContents((oldContents) => ({
      ...oldContents, // version
      ...sheetController.sheet.export_file(),
    }));

    console.log('[FileProvider] sheetController file save');
  }, [setContents, sheetController.sheet]);
  useEffect(() => {
    sheetController.saveFile = save;
  }, [sheetController, save]);

  // On mounting, (re)load the sheet
  useEffect(() => {
    if (didMount.current) return;
    didMount.current = true;
    console.log('[FileProvider] (re)loading file into the sheet...');

    // TODO true spa will clear/rebuild/reset
    // sheetController.clear();
    sheetController.sheet.load_file(fileFromServer.contents);
    // sheetController.app?.rebuild();
    // sheetController.app?.reset();
  }, [sheetController.sheet, fileFromServer]);

  // TODO debounce file changes so changes sync only every X milliseconds
  const syncChanges = useCallback(
    async (changes: any) => {
      if (uuid) {
        const id = Date.now();
        setLatestSync({ id, state: 'syncing' });
        const ok = await apiClientSingleton.postFile(uuid, changes);
        setLatestSync((prev) => (prev.id === id ? { id, state: ok ? 'idle' : 'error' } : prev));
      }
    },
    [setLatestSync, uuid]
  );

  // When the file name changes, update document title and sync to server
  useEffect(() => {
    document.title = `${name} - Quadratic`;
    syncChanges({ name });
  }, [name, syncChanges]);

  // When the contents of the file changes, sync to server
  useEffect(() => {
    syncChanges({ contents });
  }, [contents, syncChanges]);

  return <FileContext.Provider value={{ name, renameFile, contents, syncState }}>{children}</FileContext.Provider>;
};

/**
 * Consumer
 */
export const useFile = () => useContext(FileContext);
