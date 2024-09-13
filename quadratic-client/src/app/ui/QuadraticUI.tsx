import { editorInteractionStateAtom } from '@/app/atoms/editorInteractionStateAtom';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import QuadraticGrid from '@/app/gridGL/QuadraticGrid';
import { isEmbed } from '@/app/helpers/isEmbed';
import { FileDragDropWrapper } from '@/app/ui/components/FileDragDropWrapper';
import { useFileContext } from '@/app/ui/components/FileProvider';
import { Following } from '@/app/ui/components/Following';
import { PermissionOverlay } from '@/app/ui/components/PermissionOverlay';
import PresentationModeHint from '@/app/ui/components/PresentationModeHint';
import { useConnectionsFetcher } from '@/app/ui/hooks/useConnectionsFetcher';
import { useGridSettings } from '@/app/ui/hooks/useGridSettings';
import { BottomBar } from '@/app/ui/menus/BottomBar/BottomBar';
import CellTypeMenu from '@/app/ui/menus/CellTypeMenu';
import CodeEditor from '@/app/ui/menus/CodeEditor';
import { AiAssistant } from '@/app/ui/menus/CodeEditor/AiAssistant';
import { CodeEditorProvider } from '@/app/ui/menus/CodeEditor/CodeEditorContext';
import CommandPalette from '@/app/ui/menus/CommandPalette';
import ConnectionsMenu from '@/app/ui/menus/ConnectionsMenu';
import FeedbackMenu from '@/app/ui/menus/FeedbackMenu';
import GoTo from '@/app/ui/menus/GoTo';
import SheetBar from '@/app/ui/menus/SheetBar';
import Toolbar from '@/app/ui/menus/Toolbar';
import { TopBar } from '@/app/ui/menus/TopBar/TopBar';
import { useMultiplayerUsers } from '@/app/ui/menus/TopBar/useMultiplayerUsers';
import { ValidationPanel } from '@/app/ui/menus/Validations/ValidationPanel';
import { QuadraticSidebar } from '@/app/ui/QuadraticSidebar';
import { UpdateAlertVersion } from '@/app/ui/UpdateAlertVersion';
import { NewFileDialog } from '@/dashboard/components/NewFileDialog';
import { DialogRenameItem } from '@/shared/components/DialogRenameItem';
import { ShareFileDialog } from '@/shared/components/ShareDialog';
import { UserMessage } from '@/shared/components/UserMessage';
import { useFileRouteLoaderData } from '@/shared/hooks/useFileRouteLoaderData';
import { useEffect } from 'react';
import { isMobile } from 'react-device-detect';
import { useNavigation, useParams } from 'react-router';
import { useRecoilState } from 'recoil';

export default function QuadraticUI() {
  const {
    team: { uuid: teamUuid },
  } = useFileRouteLoaderData();
  const connectionsFetcher = useConnectionsFetcher();
  const [editorInteractionState, setEditorInteractionState] = useRecoilState(editorInteractionStateAtom);
  const { presentationMode } = useGridSettings();
  const navigation = useNavigation();
  const { uuid } = useParams() as { uuid: string };
  const { name, renameFile } = useFileContext();
  const { users } = useMultiplayerUsers();
  const gridSettings = useGridSettings();
  const follow = editorInteractionState.follow
    ? users.find((user) => user.session_id === editorInteractionState.follow)
    : undefined;

  // Resize the canvas when user goes in/out of presentation mode
  useEffect(() => {
    pixiApp.resize();
  }, [presentationMode, editorInteractionState.showCodeEditor]);

  // For mobile, set Headers to not visible by default
  useEffect(() => {
    if (isMobile) {
      gridSettings.setShowHeadings(false);
      pixiApp.viewportChanged();
    }
    // eslint-disable-next-line
  }, []);

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        // flexDirection: 'column',
        transition: '.3s ease opacity',
        opacity: 1,
        ...(navigation.state !== 'idle' ? { opacity: '.5', pointerEvents: 'none' } : {}),
      }}
    >
      {!presentationMode && <QuadraticSidebar />}
      <div className="flex min-w-0 flex-grow flex-col" id="main">
        {!presentationMode && <TopBar />}
        {!presentationMode && <Toolbar />}

        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          <CodeEditorProvider>
            {editorInteractionState.showAI && <AiAssistant />}
            <FileDragDropWrapper>
              <QuadraticGrid />
              {!presentationMode && <SheetBar />}
            </FileDragDropWrapper>
            {editorInteractionState.showCodeEditor && <CodeEditor />}
          </CodeEditorProvider>
          {editorInteractionState.showValidation && <ValidationPanel />}
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
      </div>

      {/* Global overlay menus */}
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
      {editorInteractionState.showCellTypeMenu && <CellTypeMenu />}
      {editorInteractionState.showCommandPalette && <CommandPalette />}
      {editorInteractionState.showGoToMenu && <GoTo />}
      {editorInteractionState.showRenameFileMenu && (
        <DialogRenameItem
          itemLabel="file"
          onClose={() => setEditorInteractionState((prev) => ({ ...prev, showRenameFileMenu: false }))}
          onSave={(newValue) => renameFile(newValue)}
          value={name}
        />
      )}
      <ConnectionsMenu />
      <PermissionOverlay />
      {!isEmbed && <PermissionOverlay />}
      <UpdateAlertVersion />
      <UserMessage />
    </div>
  );
}
