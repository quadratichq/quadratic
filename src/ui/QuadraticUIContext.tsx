import { FileProvider } from './contexts/File';
import { GlobalSnackbarProvider } from './contexts/GlobalSnackbar';
import QuadraticUI from './QuadraticUI';

// TODO we'll add these in a separate PR
// export const PixiAppContext = createContext<PixiApp>({} as PixiApp);
// export const SheetControllerContext = createContext<SheetController>({} as SheetController);

export default function QuadraticUIContext({ sheetController, fileFromServer, app }: any) {
  return (
    <FileProvider fileFromServer={fileFromServer} sheetController={sheetController}>
      <GlobalSnackbarProvider>
        {/* <PixiAppContext.Provider value={app}><SheetControllerContext.Provider value={sheetController}> */}
        <QuadraticUI app={app} sheetController={sheetController} />
        {/* </SheetControllerContext.Provider></PixiAppContext.Provider> */}
      </GlobalSnackbarProvider>
    </FileProvider>
  );
}
