import { LocalFilesProvider } from './contexts/LocalFiles';
import { GlobalSnackbarProvider } from './contexts/GlobalSnackbar';
import QuadraticUI from './QuadraticUI';

// TODO we'll add these in a separate PR
// export const PixiAppContext = createContext<PixiApp>({} as PixiApp);
// export const SheetControllerContext = createContext<SheetController>({} as SheetController);

export default function QuadraticUIContext({ sheetController, file, setFile, app }: any) {
  return (
    <GlobalSnackbarProvider>
      <LocalFilesProvider value={{ file, setFile }}>
        {/* <PixiAppContext.Provider value={app}><SheetControllerContext.Provider value={sheetController}> */}
        <QuadraticUI app={app} sheetController={sheetController} />
        {/* </SheetControllerContext.Provider></PixiAppContext.Provider> */}
      </LocalFilesProvider>
    </GlobalSnackbarProvider>
  );
}
