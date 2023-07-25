import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { SheetController } from '../../grid/controller/sheetController';
import mixpanel from 'mixpanel-browser';
import { GetFileClientRes } from '../../api-client/types';
import apiClientSingleton from '../../api-client/apiClientSingleton';

export type FileContextType = {
  file: GetFileClientRes;
  renameFile: (newFilename: string) => void;
  setFile: React.Dispatch<React.SetStateAction<GetFileClientRes>>;
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
  // TODO get rid of date_updated, date_created we don't need them
  const [file, setFile] = useState<GetFileClientRes>(fileFromServer);
  let didMount = useRef<boolean>(false);

  const renameFile = useCallback(
    (newFilename: string) => {
      // TODO keep these same mixpanel actions?
      mixpanel.track('[Files].renameCurrentFile', { newFilename });
      setFile((oldFile: GetFileClientRes) => ({ ...oldFile, name: newFilename, date_updated: Date.now() }));
    },
    [setFile]
  );

  // Create and save the fn used by the sheetController to save the file
  const save = useCallback(async (): Promise<void> => {
    setFile((oldFile: GetFileClientRes) => ({
      ...oldFile,
      date_updated: Date.now(),
      contents: {
        ...oldFile.contents, // version
        ...sheetController.sheet.export_file(),
      },
    }));

    console.log('[FileProvider] sheetController file save');
  }, [setFile, sheetController.sheet]);
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

  // When the file changes, update document title and backup file
  useEffect(() => {
    document.title = `${file.name} - Quadratic`;

    // Sync to API
    // TODO if not read-only, what happens if it fails?
    apiClientSingleton.postFile(file.uuid, file.name, file.contents);
  }, [file]);

  return <FileContext.Provider value={{ file, renameFile, setFile }}>{children}</FileContext.Provider>;
};

/**
 * Consumer
 */
export const useFile = () => useContext(FileContext);
