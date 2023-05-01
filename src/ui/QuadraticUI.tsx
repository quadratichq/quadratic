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
import { useEffect } from 'react';
import CellTypeMenu from './menus/CellTypeMenu';
import FileMenu from './menus/FileMenu';
import { FileUploadWrapper } from './components/FileUploadWrapper';
import { useGridSettings } from './menus/TopBar/SubMenus/useGridSettings';
import PresentationModeHint from './components/PresentationModeHint';
import InitialPageLoadError from './components/InitialPageLoadError';
import { GetCellsDBSetSheet } from '../grid/sheet/Cells/GetCellsDB';
import { PixiApp } from '../gridGL/pixiApp/PixiApp';
import { SheetController } from '../grid/controller/sheetController';
import ReadOnlyDialog from './components/ReadOnlyDialog';
import { IS_READONLY_MODE } from '../constants/app';
import { useLocalFiles } from './contexts/LocalFiles';
// import { UpdateLiveCells } from '../grid/actions/updateLiveCells'
import { updateCellAndDCells } from '../grid/actions/updateCellAndDCells';

export default function QuadraticUI({ app, sheetController }: { app: PixiApp; sheetController: SheetController }) {
  const [showDebugMenu] = useLocalStorage('showDebugMenu', false);
  const editorInteractionState = useRecoilValue(editorInteractionStateAtom);
  const { presentationMode } = useGridSettings();
  const { hasInitialPageLoadError } = useLocalFiles();
  // UpdateLiveCells(sheetController);

  useEffect(() => {
    sheetController.setApp(app);
  }, [sheetController, app]);


  useEffect(() => {
    const interval = setInterval(async () => {
      // update live cells
      if (sheetController.getLiveCell().length > 0) {

        try {
          sheetController.start_transaction();
          await updateCellAndDCells({
            starting_cells: sheetController.getLiveCell(),
            sheetController: sheetController,

          });
        } catch {
          return; // unsuccessful
        }
      }
    }
      , 1000);
    return () => {
      clearInterval(interval);
    };
  }, []);


  // Temporary way to attach sheet to global for use in GetCellsDB function
  useEffect(() => {
    GetCellsDBSetSheet(sheetController.sheet);
  }, [sheetController.sheet]);

  // Resize the canvas when user goes in/out of presentation mode
  useEffect(() => {
    app.resize();
  }, [presentationMode, app]);

  return (
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
      {!presentationMode && <TopBar app={app} sheetController={sheetController} />}
      {editorInteractionState.showCommandPalette && <CommandPalette app={app} sheetController={sheetController} />}
      {editorInteractionState.showGoToMenu && <GoTo app={app} sheetController={sheetController} />}
      {editorInteractionState.showFileMenu && <FileMenu app={app} />}

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

      {!presentationMode && <BottomBar sheet={sheetController.sheet} />}
      {presentationMode && <PresentationModeHint />}
      {hasInitialPageLoadError && <InitialPageLoadError />}

      {IS_READONLY_MODE && <ReadOnlyDialog />}
    </div>
  );
}
