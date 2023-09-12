import { useEffect } from 'react';
import { useNavigation, useParams } from 'react-router';
import { useRecoilState } from 'recoil';
import { editorInteractionStateAtom } from '../atoms/editorInteractionStateAtom';
import { ShareFileMenu } from '../components/ShareFileMenu';
import { SheetController } from '../grid/controller/sheetController';
import { GetCellsDBSetSheet } from '../grid/sheet/Cells/GetCellsDB';
import QuadraticGrid from '../gridGL/QuadraticGrid';
import { PixiApp } from '../gridGL/pixiApp/PixiApp';
import { focusGrid } from '../helpers/focusGrid';
import CodeEditor from '../ui/menus/CodeEditor';
import TopBar from '../ui/menus/TopBar';
import { FileUploadWrapper } from './components/FileUploadWrapper';
import { PermissionOverlay } from './components/PermissionOverlay';
import PresentationModeHint from './components/PresentationModeHint';
import BottomBar from './menus/BottomBar';
import CellTypeMenu from './menus/CellTypeMenu';
import CommandPalette from './menus/CommandPalette';
import FeedbackMenu from './menus/FeedbackMenu';
import GoTo from './menus/GoTo';
import { useGridSettings } from './menus/TopBar/SubMenus/useGridSettings';

export default function QuadraticUI({ app, sheetController }: { app: PixiApp; sheetController: SheetController }) {
  const [editorInteractionState, setEditorInteractionState] = useRecoilState(editorInteractionStateAtom);
  const { presentationMode } = useGridSettings();
  const navigation = useNavigation();
  const { uuid } = useParams() as { uuid: string };

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
        transition: '.3s ease opacity',
        opacity: 1,
        ...(navigation.state !== 'idle' ? { opacity: '.5', pointerEvents: 'none' } : {}),
      }}
    >
      {editorInteractionState.showCellTypeMenu && <CellTypeMenu />}
      {!presentationMode && <TopBar app={app} sheetController={sheetController} />}
      {editorInteractionState.showCommandPalette && <CommandPalette app={app} sheetController={sheetController} />}
      {editorInteractionState.showGoToMenu && <GoTo app={app} sheetController={sheetController} />}

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
      {editorInteractionState.showShareFileMenu && (
        <ShareFileMenu
          onClose={() => {
            setEditorInteractionState((prevState) => ({
              ...prevState,
              showShareFileMenu: false,
            }));
            // TODO the button that triggers the share menu is getting focus, not the
            // grid, even when you run this
            focusGrid();
          }}
          permission={editorInteractionState.permission}
          fileUuid={uuid}
        />
      )}
      {presentationMode && <PresentationModeHint />}

      <PermissionOverlay />
    </div>
  );
}
