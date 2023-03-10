import TopBar from '../ui/menus/TopBar';
import CodeEditor from '../ui/menus/CodeEditor';
import DebugMenu from './menus/DebugMenu/DebugMenu';
import useLocalStorage from '../hooks/useLocalStorage';
import { useRecoilValue } from 'recoil';
import { editorInteractionStateAtom } from '../atoms/editorInteractionStateAtom';
import BottomBar from './menus/BottomBar';
import QuadraticGrid from '../gridGL/QuadraticGrid';
import CommandPalette from './menus/CommandPalette';
import GoTo from './menus/GoTo';
import { useEffect, useState } from 'react';
import { PixiApp } from '../gridGL/pixiApp/PixiApp';
import { SheetController } from '../grid/controller/sheetController';
import CellTypeMenu from './menus/CellTypeMenu';
import FileMenu from './menus/FileMenu';
import { FileUploadWrapper } from './components/FileUploadWrapper';
import { useGridSettings } from './menus/TopBar/SubMenus/useGridSettings';
import PresentationModeHint from './components/PresentationModeHint';
import { useLocalFiles } from '../storage/useLocalFiles';
import { CSVImportHelpMessage } from './overlays/CSVImportHelpMessage';
import { createContext } from 'react';
import { LocalFiles } from '../storage/useLocalFiles';

// TODO move into its own file...
interface AppContextProps {
  localFiles: LocalFiles;
  app: PixiApp;
  sheetController: SheetController;
}
export const AppContext = createContext<AppContextProps>({} as AppContextProps);

interface Props {
  sheetController: SheetController;
}

export default function QuadraticUI(props: Props) {
  const [showDebugMenu] = useLocalStorage('showDebugMenu', false);
  const editorInteractionState = useRecoilValue(editorInteractionStateAtom);
  const { presentationMode } = useGridSettings();

  const { sheetController } = props;

  const localFiles = useLocalFiles(props.sheetController);
  const [app] = useState(() => new PixiApp(props.sheetController, localFiles.save));

  useEffect(() => {
    sheetController.setApp(app);
  }, [sheetController, app]);

  // Resize the canvas when user goes in/out of presentation mode
  useEffect(() => {
    app.resize();
  }, [presentationMode, app]);

  return (
    <AppContext.Provider value={{ localFiles, app, sheetController }}>
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {editorInteractionState.showCellTypeMenu && <CellTypeMenu></CellTypeMenu>}
        {showDebugMenu && <DebugMenu sheet={sheetController.sheet} />}
        {!presentationMode && <TopBar />}
        {editorInteractionState.showCommandPalette && <CommandPalette app={app} sheetController={sheetController} />}
        {editorInteractionState.showGoToMenu && <GoTo app={app} sheetController={sheetController} />}
        {editorInteractionState.showFileMenu && <FileMenu app={app} sheetController={sheetController} />}

        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          <FileUploadWrapper sheetController={sheetController} app={app}>
            <QuadraticGrid sheetController={sheetController} app={app} />
          </FileUploadWrapper>
          <CodeEditor editorInteractionState={editorInteractionState} sheet_controller={sheetController} />
        </div>

        <CSVImportHelpMessage></CSVImportHelpMessage>

        {!presentationMode && <BottomBar sheet={sheetController.sheet} />}
        {presentationMode && <PresentationModeHint />}
      </div>
    </AppContext.Provider>
  );
}
