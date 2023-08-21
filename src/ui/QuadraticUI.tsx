import { useEffect, useState } from 'react';
import { useRecoilValue } from 'recoil';
import { editorInteractionStateAtom } from '../atoms/editorInteractionStateAtom';
import { IS_READONLY_MODE } from '../constants/appConstants';
import { SheetController } from '../grid/controller/SheetController';
import QuadraticGrid from '../gridGL/QuadraticGrid';
import { PixiApp } from '../gridGL/pixiApp/PixiApp';
import TopBar from '../ui/menus/TopBar';
import { FileUploadWrapper } from './components/FileUploadWrapper';
import PresentationModeHint from './components/PresentationModeHint';
import ReadOnlyDialog from './components/ReadOnlyDialog';
import BottomBar from './menus/BottomBar';
import CellTypeMenu from './menus/CellTypeMenu';
import CodeEditor from './menus/CodeEditor';
import CommandPalette from './menus/CommandPalette';
import FeedbackMenu from './menus/FeedbackMenu';
import GoTo from './menus/GoTo';
import SheetBar from './menus/SheetBar';
import { ConfirmDeleteSheet } from './menus/SheetBar/ConfirmDeleteSheet';
import { useGridSettings } from './menus/TopBar/SubMenus/useGridSettings';

export default function QuadraticUI({ app, sheetController }: { app: PixiApp; sheetController: SheetController }) {
  const editorInteractionState = useRecoilValue(editorInteractionStateAtom);
  const { presentationMode } = useGridSettings();

  // Resize the canvas when user goes in/out of presentation mode
  useEffect(() => {
    app.resize();
  }, [presentationMode, app]);

  // used for delete sheet
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string } | undefined>();

  // todo...
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [lastName, setLastName] = useState<string | undefined>();

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
      {!presentationMode && <TopBar sheetController={sheetController} />}
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
        {editorInteractionState.showCodeEditor && <CodeEditor sheetController={sheetController} />}
      </div>

      {!presentationMode && <SheetBar sheetController={sheetController} />}
      {!presentationMode && <BottomBar sheetController={sheetController} />}
      {editorInteractionState.showFeedbackMenu && <FeedbackMenu />}
      {presentationMode && <PresentationModeHint />}

      {IS_READONLY_MODE && <ReadOnlyDialog />}

      <ConfirmDeleteSheet
        sheetController={sheetController}
        lastName={lastName}
        confirmDelete={confirmDelete}
        handleClose={() => setConfirmDelete(undefined)}
      />
    </div>
  );
}
