import { InitialFile } from '../dashboard/FileRoute';
import QuadraticUI from './QuadraticUI';
import { FileProvider } from './contexts/FileContext';

// TODO we'll add these in a separate PR
// export const PixiAppContext = createContext<PixiApp>({} as PixiApp);
// export const SheetControllerContext = createContext<SheetController>({} as SheetController);

export default function QuadraticUIContext({ initialFile }: { initialFile: InitialFile }) {
  return (
    <FileProvider initialFile={initialFile}>
      <QuadraticUI />
    </FileProvider>
  );
}
