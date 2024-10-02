import { useConnectionsFetcher } from '@/app/ui/hooks/useConnectionsFetcher';
import { useGridSettings } from '@/app/ui/hooks/useGridSettings';
import { CodeEditorProvider } from '@/app/ui/menus/CodeEditor/CodeEditorContext';
import ConnectionsMenu from '@/app/ui/menus/ConnectionsMenu';
import Toolbar from '@/app/ui/menus/Toolbar';
import { NewFileDialog } from '@/dashboard/components/NewFileDialog';
import { DialogRenameItem } from '@/shared/components/DialogRenameItem';
import { ShareFileDialog } from '@/shared/components/ShareDialog';
import { UserMessage } from '@/shared/components/UserMessage';
import { useFileRouteLoaderData } from '@/shared/hooks/useFileRouteLoaderData';
import { useEffect } from 'react';
import { isMobile } from 'react-device-detect';
import { useNavigation, useParams } from 'react-router';
import { useRecoilState } from 'recoil';
import { editorInteractionStateAtom } from '../atoms/editorInteractionStateAtom';
import QuadraticGrid from '../gridGL/QuadraticGrid';
import { pixiApp } from '../gridGL/pixiApp/PixiApp';
import { isEmbed } from '../helpers/isEmbed';
import { TopBar } from '../ui/menus/TopBar/TopBar';
import { QuadraticSidebar } from './QuadraticSidebar';
import { UpdateAlertVersion } from './UpdateAlertVersion';
import { FileDragDropWrapper } from './components/FileDragDropWrapper';
import { useFileContext } from './components/FileProvider';
import { Following } from './components/Following';
import { PermissionOverlay } from './components/PermissionOverlay';
import PresentationModeHint from './components/PresentationModeHint';
import { BottomBar } from './menus/BottomBar/BottomBar';
import CellTypeMenu from './menus/CellTypeMenu';
import CommandPalette from './menus/CommandPalette';
import FeedbackMenu from './menus/FeedbackMenu';
import SheetBar from './menus/SheetBar';
import { useMultiplayerUsers } from './menus/TopBar/useMultiplayerUsers';
import { ValidationPanel } from './menus/Validations/ValidationPanel';
import { pixiAppSettings } from '../gridGL/pixiApp/PixiAppSettings';

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

  // Show negative_offsets warning if present in URL (the result of an imported
  // file)
  useEffect(() => {
    const url = new URLSearchParams(window.location.search);
    if (url.has('negative_offsets')) {
      pixiAppSettings.snackbar('negative_offsets', 'error');
      url.delete('negative_offsets');
      window.history.replaceState({}, '', `${window.location.pathname}${url.toString() ? `?${url}` : ''}`);
    }
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
      {!presentationMode && !isEmbed && <QuadraticSidebar />}
      <div className="flex min-w-0 flex-grow flex-col" id="main">
        {!presentationMode && <TopBar />}
        {!presentationMode && !isEmbed && <Toolbar />}

        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          <FileDragDropWrapper>
            <QuadraticGrid />
            {!presentationMode && <SheetBar />}
          </FileDragDropWrapper>
          {editorInteractionState.showCodeEditor && <CodeEditorProvider />}
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
      {editorInteractionState.showRenameFileMenu && (
        <DialogRenameItem
          itemLabel="file"
          onClose={() => setEditorInteractionState((prev) => ({ ...prev, showRenameFileMenu: false }))}
          onSave={(newValue) => renameFile(newValue)}
          value={name}
        />
      )}
      <ConnectionsMenu />
      {!isEmbed && <PermissionOverlay />}
      <UpdateAlertVersion />
      <UserMessage />
    </div>
  );
}
