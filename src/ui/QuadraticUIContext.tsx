import { InitialFile } from '../dashboard/FileRoute';
import { SheetController } from '../grid/controller/SheetController';
import { PixiApp } from '../gridGL/pixiApp/PixiApp';
import QuadraticUI from './QuadraticUI';
import { FileProvider } from './contexts/FileContext';

// TODO we'll add these in a separate PR
// export const PixiAppContext = createContext<PixiApp>({} as PixiApp);
// export const SheetControllerContext = createContext<SheetController>({} as SheetController);

export default function QuadraticUIContext({
  sheetController,
  initialFile,
  app,
}: {
  initialFile: InitialFile;
  app: PixiApp;
  sheetController: SheetController;
}) {
  return (
    <FileProvider initialFile={initialFile} sheetController={sheetController}>
      <QuadraticUI app={app} sheetController={sheetController} />
    </FileProvider>
  );
}
