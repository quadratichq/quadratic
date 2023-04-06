import { createContext } from 'react';
import { LocalFiles } from '../storage/useLocalFiles';
import QuadraticUI from './QuadraticUI';

export const LocalFilesContext = createContext<LocalFiles>({} as LocalFiles);

// TODO we'll add these in a separate PR
// export const PixiAppContext = createContext<PixiApp>({} as PixiApp);
// export const SheetControllerContext = createContext<SheetController>({} as SheetController);

export default function QuadraticUIContext({ sheetController, localFiles, app }: any) {
  return (
    <LocalFilesContext.Provider value={localFiles}>
      {/* <PixiAppContext.Provider value={app}>
        <SheetControllerContext.Provider value={sheetController}> */}
      <QuadraticUI app={app} sheetController={sheetController} />
      {/* </SheetControllerContext.Provider>
      </PixiAppContext.Provider> */}
    </LocalFilesContext.Provider>
  );
}
