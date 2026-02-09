import { hasPermissionToEditFile } from '@/app/actions';
import { useEmptyChatSuggestionsSync } from '@/app/ai/hooks/useEmptyChatSuggestionsSync';
import { agentModeAtom } from '@/app/atoms/agentModeAtom';
import { aiAnalystLoadingAtom } from '@/app/atoms/aiAnalystAtom';
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
import { isAiDisabled, isEmbed } from '@/app/helpers/isEmbed';
import { AIGetFileName } from '@/app/ui/components/AIGetFileName';
import { FeatureWalkthrough } from '@/app/ui/components/FeatureWalkthrough';
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
import { ConditionalFormatPanel } from '@/app/ui/menus/ConditionalFormatting/ConditionalFormatPanel';
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
import { AI_GRADIENT } from '@/shared/constants/appConstants';
import { COMMUNITY_A1_FILE_UPDATE_URL } from '@/shared/constants/urls';
import { useRemoveInitialLoadingUI } from '@/shared/hooks/useRemoveInitialLoadingUI';
import { Button } from '@/shared/shadcn/ui/button';
import { cn } from '@/shared/shadcn/utils';
import { CrossCircledIcon } from '@radix-ui/react-icons';
import { useEffect, useMemo, useState } from 'react';
import { useNavigation, useParams } from 'react-router';
import { useRecoilState, useRecoilValue } from 'recoil';

// Check if error is likely an out-of-memory error from WASM
// We check the stack trace for allocation-related patterns since "unreachable" is generic
const isOutOfMemoryError = (error: Error | unknown): boolean => {
  const errorString = error instanceof Error ? `${error.message}\n${error.stack ?? ''}` : String(error);
  // Check for allocation-related patterns in the stack trace
  const allocationPatterns = [
    'alloc::raw_vec::handle_error',
    'alloc::raw_vec::RawVec',
    'alloc::alloc::handle_alloc_error',
    'out of memory',
    'memory allocation',
  ];
  if (allocationPatterns.some((pattern) => errorString.includes(pattern))) {
    return true;
  }
  // Check for cascaded OOM: __wbindgen_malloc fails as the first WASM frame
  // This happens after initial OOM when WASM can't allocate memory for any operation
  if (errorString.includes('unreachable')) {
    const lines = errorString.split('\n');
    const firstWasmFrame = lines.find((line) => line.includes('quadratic_core.wasm.'));
    if (firstWasmFrame?.includes('__wbindgen_malloc')) {
      return true;
    }
  }
  return false;
};

export default function QuadraticUI() {
  const { isAuthenticated } = useRootRouteLoaderData();
  const navigation = useNavigation();
  const { uuid } = useParams() as { uuid: string };
  const { name, renameFile } = useFileContext();
  const [showShareFileMenu, setShowShareFileMenu] = useRecoilState(editorInteractionStateShowShareFileMenuAtom);
  const [showRenameFileMenu, setShowRenameFileMenu] = useRecoilState(editorInteractionStateShowRenameFileMenuAtom);
  const agentMode = useRecoilValue(agentModeAtom);
  const presentationMode = useRecoilValue(presentationModeAtom);
  const showCellTypeMenu = useRecoilValue(editorInteractionStateShowCellTypeMenuAtom);
  const showCommandPalette = useRecoilValue(editorInteractionStateShowCommandPaletteAtom);
  const permissions = useRecoilValue(editorInteractionStatePermissionsAtom);
  const canEditFile = useMemo(() => hasPermissionToEditFile(permissions), [permissions]);
  // See if the aiAnalyst is running
  const aiAnalystLoading = useRecoilValue(aiAnalystLoadingAtom);

  // Sync empty chat suggestions with sheet data changes
  useEmptyChatSuggestionsSync();

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

  useRemoveInitialLoadingUI();

  if (error) {
    const isOOM = isOutOfMemoryError(error.error);
    return (
      <EmptyPage
        title={isOOM ? 'Out of memory' : 'Quadratic crashed'}
        description={
          isOOM
            ? 'Your browser ran out of memory. This can happen with large files or complex operations. Try reloading and working with smaller datasets, or contact support if you need help.'
            : 'Something went wrong. Our team has been notified of this issue. Please reload the application to continue.'
        }
        Icon={CrossCircledIcon}
        actions={<Button onClick={() => window.location.reload()}>Reload</Button>}
        error={error.error}
        source={error.from}
      />
    );
  }

  return (
    <div
      id="quadratic-ui"
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
      {!agentMode && !presentationMode && !isEmbed && <QuadraticSidebar />}
      <div className="flex min-w-0 flex-grow flex-col" id="main">
        {!presentationMode && <TopBar />}
        {!agentMode && !presentationMode && !isEmbed && <Toolbar />}

        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          {canEditFile && isAuthenticated && !isAiDisabled && <AIAnalyst />}
          {canEditFile && isAuthenticated && !isAiDisabled && <AIAnalystConnectionSchema />}

          <div className={cn('flex h-full w-full overflow-hidden', agentMode && 'pb-2 pr-2')}>
            <div
              className={cn(
                'flex h-full w-full',
                agentMode && 'rounded-lg p-0.5 shadow-lg',
                aiAnalystLoading ? `bg-gradient-to-r ${AI_GRADIENT} shadow-purple-100` : 'bg-border'
              )}
              style={{
                backgroundSize: '200% 200%',
                animation: 'shimmer 3s ease-in-out infinite',
              }}
            >
              <div className={cn('flex h-full w-full overflow-hidden', agentMode && 'rounded-md')}>
                <FileDragDropWrapper>
                  <QuadraticGrid />
                  {!presentationMode && <SheetBar />}
                  <FloatingFPS />
                  <FloatingTopLeftPosition />
                  <Coordinates />
                </FileDragDropWrapper>
                <CodeEditor />
                <ValidationPanel />
                <ConditionalFormatPanel />
                <ScheduledTasks />
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* Global overlay menus */}
      {canEditFile && isAuthenticated && !isAiDisabled && <AIGetFileName />}
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
      {!isEmbed && <FeatureWalkthrough />}
    </div>
  );
}
