import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { GridFile } from '../../schemas';
import { SheetController } from '../../grid/controller/sheetController';

export type FileContextType = {
  file: GridFile;
  setFile: React.Dispatch<React.SetStateAction<GridFile>>;
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
  fileFromServer: GridFile;
  sheetController: SheetController;
}) => {
  const [file, setFile] = useState<GridFile>(fileFromServer);
  let didMount = useRef<boolean>(false);

  // Create and save the fn used by the sheetController to save the file
  const save = useCallback(async (): Promise<void> => {
    const modified = Date.now();
    setFile((oldFile) => ({ ...oldFile, ...sheetController.sheet.export_file(), modified }));
    console.log('[FileProvider] saving file...');
  }, [sheetController.sheet]);
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
    sheetController.sheet.load_file(fileFromServer);
    // sheetController.app?.rebuild();
    // sheetController.app?.reset();
  }, [sheetController.sheet, fileFromServer]);

  // When the file changes, update document title and backup file
  useEffect(() => {
    document.title = `${file.filename} - Quadratic`;
    // apiClientSingleton.backupFile(id, currentFileContents);
  }, [file]);

  return <FileContext.Provider value={{ file, setFile }}>{children}</FileContext.Provider>;
};

/**
 * Consumer
 */
export const useFile = () => useContext(FileContext);
