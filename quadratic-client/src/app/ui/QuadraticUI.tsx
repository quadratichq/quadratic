import { useEffect } from 'react';
import { useNavigation, useParams } from 'react-router';
import { useRecoilState } from 'recoil';

import { editorInteractionStateAtom } from '@/app/atoms/editorInteractionStateAtom';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import QuadraticGrid from '@/app/gridGL/QuadraticGrid';
import { isEmbed } from '@/app/helpers/isEmbed';
import { useFileContext } from '@/app/ui/components/FileProvider';
import { FileUploadWrapper } from '@/app/ui/components/FileUploadWrapper';
import { Following } from '@/app/ui/components/Following';
import { PermissionOverlay } from '@/app/ui/components/PermissionOverlay';
import PresentationModeHint from '@/app/ui/components/PresentationModeHint';
import { BottomBar } from '@/app/ui/menus/BottomBar/BottomBar';
import CellTypeMenu from '@/app/ui/menus/CellTypeMenu';
import { CodeEditorProvider } from '@/app/ui/menus/CodeEditor/CodeEditorContext';
import CommandPalette from '@/app/ui/menus/CommandPalette';
import ConnectionsMenu from '@/app/ui/menus/ConnectionsMenu';
import FeedbackMenu from '@/app/ui/menus/FeedbackMenu';
import GoTo from '@/app/ui/menus/GoTo';
import SheetBar from '@/app/ui/menus/SheetBar';
import { useGridSettings } from '@/app/ui/menus/TopBar/SubMenus/useGridSettings';
import { TopBar } from '@/app/ui/menus/TopBar/TopBar';
import { useMultiplayerUsers } from '@/app/ui/menus/TopBar/useMultiplayerUsers';
import { UpdateAlertVersion } from '@/app/ui/UpdateAlertVersion';
import { ShareFileDialog } from '@/shared/components/ShareDialog';

export default function QuadraticUI() {
  const [editorInteractionState, setEditorInteractionState] = useRecoilState(editorInteractionStateAtom);
  const { presentationMode } = useGridSettings();
  const navigation = useNavigation();
  const { uuid } = useParams() as { uuid: string };
  const { name } = useFileContext();
  const { users } = useMultiplayerUsers();
  const follow = editorInteractionState.follow
    ? users.find((user) => user.session_id === editorInteractionState.follow)
    : undefined;

  // Resize the canvas when user goes in/out of presentation mode
  useEffect(() => {
    pixiApp.resize();
  }, [presentationMode, editorInteractionState.showCodeEditor]);

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
      {editorInteractionState.showCommandPalette && <CommandPalette />}
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
          {!presentationMode && <SheetBar />}
        </FileUploadWrapper>
        {editorInteractionState.showCodeEditor && <CodeEditorProvider />}
        <Following follow={follow} />
        <div
          style={{
            width: '100%',
            height: '100%',
            overflow: 'hidden',
            position: 'absolute',
            border: follow ? `3px solid ${follow.colorString}` : '',
            pointerEvents: 'none',
          }}
        ></div>
      </div>

      {!presentationMode && !isEmbed && <BottomBar />}
      {editorInteractionState.showFeedbackMenu && <FeedbackMenu />}
      {editorInteractionState.showShareFileMenu && (
        <ShareFileDialog
          onClose={() => {
            setEditorInteractionState((prevState) => ({
              ...prevState,
              showShareFileMenu: false,
            }));
          }}
          name={name}
          uuid={uuid}
        />
      )}
      {presentationMode && <PresentationModeHint />}

      <ConnectionsMenu />
      <PermissionOverlay />
      {!isEmbed && <PermissionOverlay />}
      <UpdateAlertVersion />
    </div>
  );
}
