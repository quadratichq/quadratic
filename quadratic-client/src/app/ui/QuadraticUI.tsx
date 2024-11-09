import {
  editorInteractionStateShowNewFileMenuAtom,
  editorInteractionStateShowRenameFileMenuAtom,
  editorInteractionStateShowShareFileMenuAtom,
} from '@/app/atoms/editorInteractionStateAtom';
import { presentationModeAtom } from '@/app/atoms/gridSettingsAtom';
import QuadraticGrid from '@/app/gridGL/QuadraticGrid';
import { isEmbed } from '@/app/helpers/isEmbed';
import { FileDragDropWrapper } from '@/app/ui/components/FileDragDropWrapper';
import { useFileContext } from '@/app/ui/components/FileProvider';
import { PermissionOverlay } from '@/app/ui/components/PermissionOverlay';
import PresentationModeHint from '@/app/ui/components/PresentationModeHint';
import { useConnectionsFetcher } from '@/app/ui/hooks/useConnectionsFetcher';
import { BottomBar } from '@/app/ui/menus/BottomBar/BottomBar';
import CellTypeMenu from '@/app/ui/menus/CellTypeMenu';
import CodeEditor from '@/app/ui/menus/CodeEditor';
import CommandPalette from '@/app/ui/menus/CommandPalette';
import ConnectionsMenu from '@/app/ui/menus/ConnectionsMenu';
import FeedbackMenu from '@/app/ui/menus/FeedbackMenu';
import SheetBar from '@/app/ui/menus/SheetBar';
import Toolbar from '@/app/ui/menus/Toolbar';
import { TopBar } from '@/app/ui/menus/TopBar/TopBar';
import { updateRecentFiles } from '@/app/ui/menus/TopBar/TopBarMenus/updateRecentFiles';
import { ValidationPanel } from '@/app/ui/menus/Validations/ValidationPanel';
import { QuadraticSidebar } from '@/app/ui/QuadraticSidebar';
import { UpdateAlertVersion } from '@/app/ui/UpdateAlertVersion';
import { NewFileDialog } from '@/dashboard/components/NewFileDialog';
import { DialogRenameItem } from '@/shared/components/DialogRenameItem';
import { ShareFileDialog } from '@/shared/components/ShareDialog';
import { UserMessage } from '@/shared/components/UserMessage';
import { useFileRouteLoaderData } from '@/shared/hooks/useFileRouteLoaderData';
import { useNavigation, useParams } from 'react-router';
import { useRecoilState, useRecoilValue } from 'recoil';

export default function QuadraticUI() {
  const {
    team: { uuid: teamUuid },
  } = useFileRouteLoaderData();
  const connectionsFetcher = useConnectionsFetcher();
  const navigation = useNavigation();
  const { uuid } = useParams() as { uuid: string };
  const { name, renameFile } = useFileContext();
  const [showShareFileMenu, setShowShareFileMenu] = useRecoilState(editorInteractionStateShowShareFileMenuAtom);
  const [showNewFileMenu, setShowNewFileMenu] = useRecoilState(editorInteractionStateShowNewFileMenuAtom);
  const [showRenameFileMenu, setShowRenameFileMenu] = useRecoilState(editorInteractionStateShowRenameFileMenuAtom);
  const presentationMode = useRecoilValue(presentationModeAtom);

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
      {showNewFileMenu && (
        <NewFileDialog
          onClose={() => setShowNewFileMenu(false)}
          isPrivate={true}
          connections={connectionsFetcher.data ? connectionsFetcher.data.connections : []}
          teamUuid={teamUuid}
        />
      )}
      {presentationMode && <PresentationModeHint />}
      <CellTypeMenu />
      <CommandPalette />
      {showRenameFileMenu && (
        <DialogRenameItem
          itemLabel="file"
          onClose={() => setShowRenameFileMenu(false)}
          onSave={(newValue) => {
            updateRecentFiles(uuid, newValue, true);
            renameFile(newValue);
          }}
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
