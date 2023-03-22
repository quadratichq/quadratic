import { createContext, useState } from 'react';
import { SheetController } from '../grid/controller/sheetController';
import { PixiApp } from '../gridGL/pixiApp/PixiApp';
import { useLocalFiles } from '../storage/useLocalFiles';
import { LocalFiles } from '../storage/useLocalFiles';
import QuadraticUI from './QuadraticUI';

export const LocalFilesContext = createContext<LocalFiles>({} as LocalFiles);
export const PixiAppContext = createContext<PixiApp>({} as PixiApp);
export const SheetControllerContext = createContext<SheetController>({} as SheetController);

export default function QuadraticUIContext() {
  const [sheetController] = useState<SheetController>(new SheetController());
  const localFiles = useLocalFiles(sheetController);
  const [app] = useState(() => new PixiApp(sheetController, localFiles.save));

  return (
    <LocalFilesContext.Provider value={localFiles}>
      <PixiAppContext.Provider value={app}>
        <SheetControllerContext.Provider value={sheetController}>
          <QuadraticUI app={app} sheetController={sheetController} />
        </SheetControllerContext.Provider>
      </PixiAppContext.Provider>
    </LocalFilesContext.Provider>
  );
}
