import { useConnectionsFetcher } from '@/app/ui/hooks/useConnectionsFetcher';
import { CodeEditorProvider } from '@/app/ui/menus/CodeEditor/CodeEditorContext';
import ConnectionsMenu from '@/app/ui/menus/ConnectionsMenu';
import { NewFileDialog } from '@/dashboard/components/NewFileDialog';
import { ShareFileDialog } from '@/shared/components/ShareDialog';
import { UserMessage } from '@/shared/components/UserMessage';
import { useFileRouteLoaderData } from '@/shared/hooks/useFileRouteLoaderData';
import { useEffect } from 'react';
import { useNavigation, useParams } from 'react-router';
import { useRecoilState } from 'recoil';
import { editorInteractionStateAtom } from '../atoms/editorInteractionStateAtom';
import QuadraticGrid from '../gridGL/QuadraticGrid';
import { pixiApp } from '../gridGL/pixiApp/PixiApp';
import { isEmbed } from '../helpers/isEmbed';
import { TopBar } from '../ui/menus/TopBar/TopBar';
import { UpdateAlertVersion } from './UpdateAlertVersion';
import { useFileContext } from './components/FileProvider';
import { FileUploadWrapper } from './components/FileUploadWrapper';
import { Following } from './components/Following';
import { PermissionOverlay } from './components/PermissionOverlay';
import PresentationModeHint from './components/PresentationModeHint';
import { BottomBar } from './menus/BottomBar/BottomBar';
import CellTypeMenu from './menus/CellTypeMenu';
import CommandPalette from './menus/CommandPalette';
import FeedbackMenu from './menus/FeedbackMenu';
import GoTo from './menus/GoTo';
import SheetBar from './menus/SheetBar';
import { useGridSettings } from './menus/TopBar/SubMenus/useGridSettings';
import { useMultiplayerUsers } from './menus/TopBar/useMultiplayerUsers';

export default function QuadraticUI() {
  const {
    team: { uuid: teamUuid },
  } = useFileRouteLoaderData();
  const connectionsFetcher = useConnectionsFetcher();
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
      {editorInteractionState.showNewFileMenu && (
        <NewFileDialog
          onClose={() => {
            setEditorInteractionState((prev) => ({ ...prev, showNewFileMenu: false }));
          }}
          isPrivate={true}
          connections={connectionsFetcher.data ? connectionsFetcher.data.connections : []}
          teamUuid={teamUuid}
        />
      )}
      {presentationMode && <PresentationModeHint />}

      <ConnectionsMenu />
      <PermissionOverlay />
      {!isEmbed && <PermissionOverlay />}
      <UpdateAlertVersion />
      <UserMessage />
    </div>
  );
}
