import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { GridFile } from '../../schemas';
import { SheetController } from '../../grid/controller/sheetController';
import mixpanel from 'mixpanel-browser';

export type FileContextType = {
  file: GridFile;
  renameFile: (newFilename: string) => void;
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

  const renameFile = useCallback(
    (newFilename: string) => {
      // TODO keep these same mixpanel actions?
      mixpanel.track('[Files].renameCurrentFile', { newFilename });
      setFile((oldFile: GridFile) => ({ ...oldFile, filename: newFilename, modified: Date.now() }));
    },
    [setFile]
  );

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

    // TODO sync to API (if not read-only)
    // apiClientSingleton.backupFile(id, currentFileContents);
  }, [file]);

  return <FileContext.Provider value={{ file, renameFile, setFile }}>{children}</FileContext.Provider>;
};

/**
 * Consumer
 */
export const useFile = () => useContext(FileContext);
