import { hasPermissionToEditFile } from '@/app/actions';
import {
  editorInteractionStatePermissionsAtom,
  editorInteractionStateShowRenameFileMenuAtom,
  editorInteractionStateShowShareFileMenuAtom,
} from '@/app/atoms/editorInteractionStateAtom';
import { presentationModeAtom } from '@/app/atoms/gridSettingsAtom';
import { pixiAppSettings } from '@/app/gridGL/pixiApp/PixiAppSettings';
import QuadraticGrid from '@/app/gridGL/QuadraticGrid';
import { isEmbed } from '@/app/helpers/isEmbed';
import { FileDragDropWrapper } from '@/app/ui/components/FileDragDropWrapper';
import { useFileContext } from '@/app/ui/components/FileProvider';
import { PermissionOverlay } from '@/app/ui/components/PermissionOverlay';
import PresentationModeHint from '@/app/ui/components/PresentationModeHint';
import { AIAnalyst } from '@/app/ui/menus/AIAnalyst/AIAnalyst';
import { BottomBar } from '@/app/ui/menus/BottomBar/BottomBar';
import CellTypeMenu from '@/app/ui/menus/CellTypeMenu';
import CodeEditor from '@/app/ui/menus/CodeEditor';
import CommandPalette from '@/app/ui/menus/CommandPalette';
import ConnectionsMenu from '@/app/ui/menus/ConnectionsMenu';
import FeedbackMenu from '@/app/ui/menus/FeedbackMenu';
import SheetBar from '@/app/ui/menus/SheetBar';
import Toolbar from '@/app/ui/menus/Toolbar';
import { TopBar } from '@/app/ui/menus/TopBar/TopBar';
import { ValidationPanel } from '@/app/ui/menus/Validations/ValidationPanel';
import { QuadraticSidebar } from '@/app/ui/QuadraticSidebar';
import { UpdateAlertVersion } from '@/app/ui/UpdateAlertVersion';
import { useRootRouteLoaderData } from '@/routes/_root';
import { DialogRenameItem } from '@/shared/components/DialogRenameItem';
import { ShareFileDialog } from '@/shared/components/ShareDialog';
import { UserMessage } from '@/shared/components/UserMessage';
import { useEffect, useMemo } from 'react';
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
  const permissions = useRecoilValue(editorInteractionStatePermissionsAtom);
  const canEditFile = useMemo(() => hasPermissionToEditFile(permissions), [permissions]);

  // Show negative_offsets warning if present in URL (the result of an imported
  // file)
  useEffect(() => {
    const url = new URLSearchParams(window.location.search);
    if (url.has('negative_offsets')) {
      setTimeout(() => pixiAppSettings.snackbar('negative_offsets', 'error', true));
      url.delete('negative_offsets');
      window.history.replaceState({}, '', `${window.location.pathname}${url.toString() ? `?${url}` : ''}`);
    }
  }, []);

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
          {canEditFile && isAuthenticated && <AIAnalyst />}
          <FileDragDropWrapper>
            <QuadraticGrid />
            {!presentationMode && <SheetBar />}
          </FileDragDropWrapper>
          <CodeEditor />
          <ValidationPanel />
        </div>

        {!presentationMode && !isEmbed && <BottomBar />}
      </div>
      {/* Global overlay menus */}
      <FeedbackMenu />
      {showShareFileMenu && <ShareFileDialog onClose={() => setShowShareFileMenu(false)} name={name} uuid={uuid} />}
      {presentationMode && <PresentationModeHint />}
      <CellTypeMenu />
      <CommandPalette />
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
    </div>
  );
}
