import { SheetController } from '../grid/controller/sheetController';
import { PixiApp } from '../gridGL/pixiApp/PixiApp';
import QuadraticUI from './QuadraticUI';
import { FileProvider } from './components/FileProvider';

// TODO we'll add these in a separate PR
// export const PixiAppContext = createContext<PixiApp>({} as PixiApp);
// export const SheetControllerContext = createContext<SheetController>({} as SheetController);

export default function QuadraticUIContext({
  sheetController,
  app,
}: {
  app: PixiApp;
  sheetController: SheetController;
}) {
  return (
    <FileProvider sheetController={sheetController}>
      {/* <PixiAppContext.Provider value={app}><SheetControllerContext.Provider value={sheetController}> */}
      <QuadraticUI app={app} sheetController={sheetController} />
      {/* </SheetControllerContext.Provider></PixiAppContext.Provider> */}
    </FileProvider>
  );
}
