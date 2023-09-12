import { useEffect, useState } from 'react';
import { useNavigation } from 'react-router';
import { useRecoilValue } from 'recoil';
import { editorInteractionStateAtom } from '../atoms/editorInteractionStateAtom';
import QuadraticGrid from '../gridGL/QuadraticGrid';
import { pixiApp } from '../gridGL/pixiApp/PixiApp';
import TopBar from '../ui/menus/TopBar';
import { FileUploadWrapper } from './components/FileUploadWrapper';
import { PermissionOverlay } from './components/PermissionOverlay';
import PresentationModeHint from './components/PresentationModeHint';
import BottomBar from './menus/BottomBar';
import CellTypeMenu from './menus/CellTypeMenu';
import CodeEditor from './menus/CodeEditor';
import CommandPalette from './menus/CommandPalette';
import FeedbackMenu from './menus/FeedbackMenu';
import GoTo from './menus/GoTo';
import ShareFileMenu from './menus/ShareFileMenu';
import SheetBar from './menus/SheetBar';
import { ConfirmDeleteSheet } from './menus/SheetBar/ConfirmDeleteSheet';
import { useGridSettings } from './menus/TopBar/SubMenus/useGridSettings';

export default function QuadraticUI() {
  const editorInteractionState = useRecoilValue(editorInteractionStateAtom);
  const { presentationMode } = useGridSettings();
  const navigation = useNavigation();

  // Resize the canvas when user goes in/out of presentation mode
  useEffect(() => {
    pixiApp.resize();
  }, [presentationMode]);

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
        transition: '.3s ease opacity',
        opacity: 1,
        ...(navigation.state !== 'idle' ? { opacity: '.5', pointerEvents: 'none' } : {}),
      }}
    >
      {editorInteractionState.showCellTypeMenu && <CellTypeMenu />}
      {!presentationMode && <TopBar />}
      {editorInteractionState.showCommandPalette && <CommandPalette confirmSheetDelete={() => 0} />}
      {editorInteractionState.showGoToMenu && <GoTo />}

      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        <FileUploadWrapper>
          <QuadraticGrid />
        </FileUploadWrapper>
        {editorInteractionState.showCodeEditor && <CodeEditor />}
      </div>

      {!presentationMode && <SheetBar />}
      {!presentationMode && <BottomBar />}
      {editorInteractionState.showFeedbackMenu && <FeedbackMenu />}
      {editorInteractionState.showShareFileMenu && <ShareFileMenu />}
      {presentationMode && <PresentationModeHint />}

      <ConfirmDeleteSheet
        lastName={lastName}
        confirmDelete={confirmDelete}
        handleClose={() => setConfirmDelete(undefined)}
      />

      <PermissionOverlay />
    </div>
  );
}
