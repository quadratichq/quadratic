import {
  isAvailableBecauseCanEditFile,
  isAvailableBecauseFileLocationIsAccessibleAndWriteable,
  provideFeedbackAction,
} from '@/app/actions';
import { editorInteractionStateAtom } from '@/app/atoms/editorInteractionStateAtom';
import { sheets } from '@/app/grid/controller/Sheets';
import { doubleClickCell } from '@/app/gridGL/interaction/pointer/doubleClickCell';
import { KeyboardSymbols } from '@/app/helpers/keyboardSymbols';
import { useGridSettings } from '@/app/ui/hooks/useGridSettings';
import { KernelMenu } from '@/app/ui/menus/BottomBar/KernelMenu';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { useRootRouteLoaderData } from '@/routes/_root';
import {
  CodeCellOutlineOff,
  CodeCellOutlineOn,
  CodeIcon,
  DatabaseIcon,
  DocumentationIcon,
  FeedbackIcon,
  ManageSearch,
  MemoryIcon,
} from '@/shared/components/Icons';
import { QuadraticLogo } from '@/shared/components/QuadraticLogo';
import { DOCUMENTATION_URL } from '@/shared/constants/urls';
import { useFileRouteLoaderData } from '@/shared/hooks/useFileRouteLoaderData';
import { Button } from '@/shared/shadcn/ui/button';
import { Tooltip, TooltipContent, TooltipPortal, TooltipTrigger } from '@/shared/shadcn/ui/tooltip';
import { TooltipProvider } from '@radix-ui/react-tooltip';
import { forwardRef, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useRecoilState } from 'recoil';

export const QuadraticSidebar = () => {
  const [editorInteractionState, setEditorInteractionState] = useRecoilState(editorInteractionStateAtom);
  const gridSettings = useGridSettings();
  const { isAuthenticated } = useRootRouteLoaderData();
  const {
    userMakingRequest: { fileTeamPrivacy, teamPermissions },
  } = useFileRouteLoaderData();

  const isAvailableArgs = {
    filePermissions: editorInteractionState.permissions,
    fileTeamPrivacy,
    isAuthenticated,
    teamPermissions,
  };

  const canEditFile = isAvailableBecauseCanEditFile(isAvailableArgs);
  const canDoTeamsStuff = isAvailableBecauseFileLocationIsAccessibleAndWriteable(isAvailableArgs);

  const sheet = sheets.sheet;
  const cursor = sheet.cursor;
  const cursorPosition = cursor.cursorPosition;

  return (
    <TooltipProvider>
      <nav className="hidden h-full w-12 flex-shrink-0 flex-col border-r border-border bg-accent lg:flex">
        <SidebarTooltip label="Back to dashboard">
          <Link
            to="/"
            reloadDocument
            className="hover flex h-12 items-center justify-center border-b border-border text-muted-foreground"
          >
            <QuadraticLogo />
          </Link>
        </SidebarTooltip>
        <div className="mt-2">
          {canEditFile && (
            <SidebarTooltip label="Insert code cell" shortcut={'/'}>
              <SidebarButton
                onClick={async () => {
                  const column = cursorPosition.x;
                  const row = cursorPosition.y;
                  const code = await quadraticCore.getCodeCell(sheets.sheet.id, column, row);

                  if (code) {
                    doubleClickCell({ column: Number(code.x), row: Number(code.y), language: code.language, cell: '' });
                  } else {
                    setEditorInteractionState((prev) => ({ ...prev, showCellTypeMenu: true }));
                  }
                }}
              >
                <CodeIcon />
              </SidebarButton>
            </SidebarTooltip>
          )}

          <SidebarTooltip label={(gridSettings.showCellTypeOutlines ? 'Hide' : 'Show') + ' code cell outlines'}>
            <SidebarButton onClick={() => gridSettings.setShowCellTypeOutlines(!gridSettings.showCellTypeOutlines)}>
              {gridSettings.showCellTypeOutlines ? <CodeCellOutlineOn /> : <CodeCellOutlineOff />}
            </SidebarButton>
          </SidebarTooltip>

          {canDoTeamsStuff && (
            <SidebarTooltip label="Connections">
              <SidebarButton
                onClick={() => setEditorInteractionState((prev) => ({ ...prev, showConnectionsMenu: true }))}
              >
                <DatabaseIcon />
              </SidebarButton>
            </SidebarTooltip>
          )}

          {canEditFile && (
            <KernelMenu>
              <SidebarTooltip label="Kernel">
                <SidebarButton onClick={() => {}}>
                  <MemoryIcon />
                </SidebarButton>
              </SidebarTooltip>
            </KernelMenu>
          )}

          <SidebarTooltip label="Command palette" shortcut={KeyboardSymbols.Command + 'P'}>
            <SidebarButton onClick={() => setEditorInteractionState((prev) => ({ ...prev, showCommandPalette: true }))}>
              <ManageSearch />
            </SidebarButton>
          </SidebarTooltip>
        </div>
        <div className="mt-auto">
          {provideFeedbackAction.isAvailable(isAvailableArgs) && (
            <SidebarTooltip label={provideFeedbackAction.label}>
              <SidebarButton onClick={() => setEditorInteractionState((prev) => ({ ...prev, showFeedbackMenu: true }))}>
                <FeedbackIcon />
              </SidebarButton>
            </SidebarTooltip>
          )}
          <SidebarTooltip label="Documentation">
            <SidebarButton>
              <Link to={DOCUMENTATION_URL} target="_blank" rel="noreferrer">
                <DocumentationIcon />
              </Link>
            </SidebarButton>
          </SidebarTooltip>
        </div>
      </nav>
    </TooltipProvider>
  );
};

// Define the props type
interface SidebarButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
}

// Properly forward the ref
const SidebarButton = forwardRef<HTMLButtonElement, SidebarButtonProps>(({ children, onClick, ...props }, ref) => {
  return (
    <Button
      ref={ref}
      onClick={onClick}
      variant="ghost"
      size="icon"
      className="h-10 w-full text-muted-foreground hover:text-foreground"
      {...props}
    >
      {children}
    </Button>
  );
});

function SidebarTooltip({
  children,
  label,
  shortcut,
}: {
  children: React.ReactNode;
  label: string;
  shortcut?: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipPortal>
        <TooltipContent side="right" className="flex gap-1">
          <p>{label}</p>
          {shortcut && <p className="opacity-50">({shortcut})</p>}
        </TooltipContent>
      </TooltipPortal>
    </Tooltip>
  );
}
