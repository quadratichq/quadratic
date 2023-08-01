import QuadraticUI from './QuadraticUI';
import { FileProvider } from './contexts/File';

// TODO we'll add these in a separate PR
// export const PixiAppContext = createContext<PixiApp>({} as PixiApp);
// export const SheetControllerContext = createContext<SheetController>({} as SheetController);

export default function QuadraticUIContext({ sheetController, fileFromServer, app }: any) {
  return (
    <FileProvider fileFromServer={fileFromServer} sheetController={sheetController}>
      {/* <PixiAppContext.Provider value={app}><SheetControllerContext.Provider value={sheetController}> */}
      <QuadraticUI app={app} sheetController={sheetController} />
      {/* </SheetControllerContext.Provider></PixiAppContext.Provider> */}
    </FileProvider>
  );
}
