import { useEffect } from 'react';
import { useRecoilValue } from 'recoil';
import { editorInteractionStateAtom } from '../atoms/editorInteractionStateAtom';
import { IS_READONLY_MODE } from '../constants/app';
import { SheetController } from '../grid/controller/sheetController';
import { GetCellsDBSetSheet } from '../grid/sheet/Cells/GetCellsDB';
import QuadraticGrid from '../gridGL/QuadraticGrid';
import { PixiApp } from '../gridGL/pixiApp/PixiApp';
import CodeEditor from '../ui/menus/CodeEditor';
import TopBar from '../ui/menus/TopBar';
import { FileUploadWrapper } from './components/FileUploadWrapper';
import PresentationModeHint from './components/PresentationModeHint';
import ReadOnlyDialog from './components/ReadOnlyDialog';
import BottomBar from './menus/BottomBar';
import CellTypeMenu from './menus/CellTypeMenu';
import CommandPalette from './menus/CommandPalette';
import FeedbackMenu from './menus/FeedbackMenu';
import GoTo from './menus/GoTo';
import ShareMenu from './menus/ShareMenu';
import { useGridSettings } from './menus/TopBar/SubMenus/useGridSettings';

export default function QuadraticUI({ app, sheetController }: { app: PixiApp; sheetController: SheetController }) {
  const editorInteractionState = useRecoilValue(editorInteractionStateAtom);
  const { presentationMode } = useGridSettings();

  useEffect(() => {
    sheetController.setApp(app);
  }, [sheetController, app]);

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
      {editorInteractionState.showCellTypeMenu && <CellTypeMenu />}
      {!presentationMode && <TopBar app={app} sheetController={sheetController} />}
      {editorInteractionState.showCommandPalette && <CommandPalette app={app} sheetController={sheetController} />}
      {editorInteractionState.showGoToMenu && <GoTo app={app} sheetController={sheetController} />}
      {editorInteractionState.showShareMenu && <ShareMenu />}

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
        <CodeEditor sheet_controller={sheetController} />
      </div>

      {!presentationMode && <BottomBar sheet={sheetController.sheet} />}
      {editorInteractionState.showFeedbackMenu && <FeedbackMenu />}
      {presentationMode && <PresentationModeHint />}

      {IS_READONLY_MODE && <ReadOnlyDialog />}
    </div>
  );
}
