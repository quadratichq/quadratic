import { hasPermissionToEditFile } from '@/app/actions';
import { aiAnalystLoadingAtom, showAIAnalystAtom } from '@/app/atoms/aiAnalystAtom';
import {
  editorInteractionStatePermissionsAtom,
  editorInteractionStateShowCellTypeMenuAtom,
  editorInteractionStateShowCommandPaletteAtom,
  editorInteractionStateShowRenameFileMenuAtom,
  editorInteractionStateShowShareFileMenuAtom,
} from '@/app/atoms/editorInteractionStateAtom';
import { presentationModeAtom } from '@/app/atoms/gridSettingsAtom';
import { events } from '@/app/events/events';
import { pixiAppSettings } from '@/app/gridGL/pixiApp/PixiAppSettings';
import { QuadraticGrid } from '@/app/gridGL/QuadraticGrid';
import { isEmbed } from '@/app/helpers/isEmbed';
import { AIGetFileName } from '@/app/ui/components/AIGetFileName';
import { FileDragDropWrapper } from '@/app/ui/components/FileDragDropWrapper';
import { useFileContext } from '@/app/ui/components/FileProvider';
import { FloatingFPS } from '@/app/ui/components/FloatingFPS';
import { FloatingTopLeftPosition } from '@/app/ui/components/FloatingTopLeftPosition';
import { PermissionOverlay } from '@/app/ui/components/PermissionOverlay';
import { PresentationModeHint } from '@/app/ui/components/PresentationModeHint';
import { AIAnalyst } from '@/app/ui/menus/AIAnalyst/AIAnalyst';
import { AIAnalystConnectionSchema } from '@/app/ui/menus/AIAnalyst/AIAnalystConnectionSchema';
import { Coordinates } from '@/app/ui/menus/BottomBar/Coordinates';
import { CellTypeMenu } from '@/app/ui/menus/CellTypeMenu/CellTypeMenu';
import { CodeEditor } from '@/app/ui/menus/CodeEditor/CodeEditor';
import { CommandPalette } from '@/app/ui/menus/CommandPalette/CommandPalette';
import { ConnectionsMenu } from '@/app/ui/menus/ConnectionsMenu/ConnectionsMenu';
import { FeedbackMenu } from '@/app/ui/menus/FeedbackMenu/FeedbackMenu';
import { ScheduledTasks } from '@/app/ui/menus/ScheduledTasks/ScheduledTasks';
import { SheetBar } from '@/app/ui/menus/SheetBar/SheetBar';
import { Toolbar } from '@/app/ui/menus/Toolbar/Toolbar';
import { TopBar } from '@/app/ui/menus/TopBar/TopBar';
import { ValidationPanel } from '@/app/ui/menus/Validations/ValidationPanel';
import { QuadraticSidebar } from '@/app/ui/QuadraticSidebar';
import { UpdateAlertVersion } from '@/app/ui/UpdateAlertVersion';
import { useRootRouteLoaderData } from '@/routes/_root';
import { ChangelogDialog } from '@/shared/components/ChangelogDialog';
import { DialogRenameItem } from '@/shared/components/DialogRenameItem';
import { EmptyPage } from '@/shared/components/EmptyPage';
import { SettingsDialog } from '@/shared/components/SettingsDialog';
import { ShareFileDialog } from '@/shared/components/ShareDialog';
import { UserMessage } from '@/shared/components/UserMessage';
import { COMMUNITY_A1_FILE_UPDATE_URL } from '@/shared/constants/urls';
import { useRemoveInitialLoadingUI } from '@/shared/hooks/useRemoveInitialLoadingUI';
import { Button } from '@/shared/shadcn/ui/button';
import { cn } from '@/shared/shadcn/utils';
import { CrossCircledIcon } from '@radix-ui/react-icons';
import { useEffect, useMemo, useState } from 'react';
import { useNavigation, useParams } from 'react-router';
import { useRecoilState, useRecoilValue } from 'recoil';

export default function QuadraticUI() {
  const { isAuthenticated } = useRootRouteLoaderData();
  const navigation = useNavigation();
  const { uuid } = useParams() as { uuid: string };
  const { name, renameFile } = useFileContext();
  const [showShareFileMenu, setShowShareFileMenu] = useRecoilState(editorInteractionStateShowShareFileMenuAtom);
  const [showRenameFileMenu, setShowRenameFileMenu] = useRecoilState(editorInteractionStateShowRenameFileMenuAtom);
  const presentationMode = useRecoilValue(presentationModeAtom);
  const showCellTypeMenu = useRecoilValue(editorInteractionStateShowCellTypeMenuAtom);
  const showCommandPalette = useRecoilValue(editorInteractionStateShowCommandPaletteAtom);
  const permissions = useRecoilValue(editorInteractionStatePermissionsAtom);
  const canEditFile = useMemo(() => hasPermissionToEditFile(permissions), [permissions]);

  const [error, setError] = useState<{ from: string; error: Error | unknown } | null>(null);
  useEffect(() => {
    const handleError = (from: string, error: Error | unknown) => setError({ from, error });
    events.on('coreError', handleError);
    return () => {
      events.off('coreError', handleError);
    };
  }, []);

  // Show negative_offsets warning if present in URL (the result of an imported
  // file)
  useEffect(() => {
    const url = new URLSearchParams(window.location.search);
    if (url.has('negative_offsets')) {
      setTimeout(() =>
        pixiAppSettings.snackbar('File automatically updated for A1 notation.', {
          stayOpen: true,
          button: {
            title: 'Learn more',
            callback: () => window.open(COMMUNITY_A1_FILE_UPDATE_URL, '_blank'),
          },
        })
      );
      url.delete('negative_offsets');
      window.history.replaceState({}, '', `${window.location.pathname}${url.toString() ? `?${url}` : ''}`);
    }
  }, []);

  const showAIAnalyst = useRecoilValue(showAIAnalystAtom);
  const aiAnalystLoading = useRecoilValue(aiAnalystLoadingAtom);

  useRemoveInitialLoadingUI();

  if (error) {
    return (
      <EmptyPage
        title="Quadratic crashed"
        description="Something went wrong. Our team has been notified of this issue. Please reload the application to continue."
        Icon={CrossCircledIcon}
        actions={<Button onClick={() => window.location.reload()}>Reload</Button>}
        error={error.error}
        source={error.from}
      />
    );
  }

  return (
    <div className="relative flex h-full w-full">
      {canEditFile && isAuthenticated && <AIAnalyst />}
      <div className={cn(showAIAnalyst && 'overflow-hidden p-2 pl-0')}>
        <div
          id="quadratic-ui"
          className={cn(
            showAIAnalyst && 'overflow-hidden rounded-lg border-2 shadow-lg',
            showAIAnalyst && (aiAnalystLoading ? 'border-purple-600 shadow-purple-600/20' : 'border-border shadow')
          )}
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
              {canEditFile && isAuthenticated && <AIAnalystConnectionSchema />}
              <FileDragDropWrapper>
                <QuadraticGrid />
                {!presentationMode && <SheetBar />}
                <FloatingFPS />
                <FloatingTopLeftPosition />
                <Coordinates />
              </FileDragDropWrapper>
              <CodeEditor />
              <ValidationPanel />
              <ScheduledTasks />
            </div>
          </div>
          {/* Global overlay menus */}
          {canEditFile && isAuthenticated && <AIGetFileName />}
          <FeedbackMenu />
          {showShareFileMenu && <ShareFileDialog onClose={() => setShowShareFileMenu(false)} name={name} uuid={uuid} />}
          {presentationMode && <PresentationModeHint />}
          {showCellTypeMenu && <CellTypeMenu />}
          {showCommandPalette && <CommandPalette />}
          {showRenameFileMenu && (
            <DialogRenameItem
              itemLabel="file"
              onClose={() => setShowRenameFileMenu(false)}
              onSave={(newValue) => renameFile(newValue)}
              value={name}
            />
          )}
          <ConnectionsMenu />
          {!isEmbed && <PermissionOverlay />}
          <UpdateAlertVersion />
          <UserMessage />
          <SettingsDialog />
          <ChangelogDialog />
        </div>
      </div>
    </div>
  );
}
