import { useEffect } from 'react';
import { useNavigation, useParams } from 'react-router';
import { useRecoilState } from 'recoil';
import { editorInteractionStateAtom } from '../atoms/editorInteractionStateAtom';
import { ShareFileMenu } from '../components/ShareFileMenu';
import QuadraticGrid from '../gridGL/QuadraticGrid';
import { pixiApp } from '../gridGL/pixiApp/PixiApp';
import { focusGrid } from '../helpers/focusGrid';
import CodeEditor from '../ui/menus/CodeEditor';
import TopBar from '../ui/menus/TopBar';
import { FileUploadWrapper } from './components/FileUploadWrapper';
import { PermissionOverlay } from './components/PermissionOverlay';
import PresentationModeHint from './components/PresentationModeHint';
import { TransactionBusy } from './components/TransactionBusy';
import BottomBar from './menus/BottomBar';
import CellTypeMenu from './menus/CellTypeMenu';
import CommandPalette from './menus/CommandPalette';
import FeedbackMenu from './menus/FeedbackMenu';
import GoTo from './menus/GoTo';
import SheetBar from './menus/SheetBar';
import { useGridSettings } from './menus/TopBar/SubMenus/useGridSettings';

export default function QuadraticUI() {
  const [editorInteractionState, setEditorInteractionState] = useRecoilState(editorInteractionStateAtom);
  const { presentationMode } = useGridSettings();
  const navigation = useNavigation();
  const { uuid } = useParams() as { uuid: string };

  // Resize the canvas when user goes in/out of presentation mode
  useEffect(() => {
    pixiApp.resize();
  }, [presentationMode]);

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
      {editorInteractionState.showShareFileMenu && (
        <ShareFileMenu
          fetcherUrl={`/api/files/${uuid}/sharing`}
          onClose={() => {
            setEditorInteractionState((prevState) => ({
              ...prevState,
              showShareFileMenu: false,
            }));
            setTimeout(() => {
              focusGrid();
            }, 200);
          }}
          uuid={uuid}
        />
      )}
      {presentationMode && <PresentationModeHint />}
      <TransactionBusy />
      <PermissionOverlay />
    </div>
  );
}
