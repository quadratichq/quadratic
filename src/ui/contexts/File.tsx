import mixpanel from 'mixpanel-browser';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router';
import { GridFile } from 'schemas';
import apiClientSingleton from '../../api-client/apiClientSingleton';
import { GetFileClientRes } from '../../api-client/types';
import { SheetController } from '../../grid/controller/sheetController';

export type FileContextType = {
  name: string;
  renameFile: (newName: string) => void;
  contents: GridFile;
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

  // When the file name changes, update document title and sync to server
  useEffect(() => {
    if (uuid) {
      document.title = `${name} - Quadratic`;
      apiClientSingleton.postFile(uuid, { name });
    }
  }, [name, uuid]);

  // When the contents of the file changes, sync to server
  useEffect(() => {
    if (uuid) {
      apiClientSingleton.postFile(uuid, { contents });
    }
  }, [contents, uuid]);

  return <FileContext.Provider value={{ name, renameFile, contents }}>{children}</FileContext.Provider>;
};

/**
 * Consumer
 */
export const useFile = () => useContext(FileContext);
