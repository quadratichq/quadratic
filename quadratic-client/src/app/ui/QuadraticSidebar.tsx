import { editorInteractionStateAtom } from '@/app/atoms/editorInteractionStateAtom';
import { KeyboardSymbols } from '@/app/helpers/keyboardSymbols';
import { useGridSettings } from '@/app/ui/menus/TopBar/SubMenus/useGridSettings';
import {
  CodeCellOutlineOff,
  CodeCellOutlineOn,
  CodeIcon,
  FeedbackIcon,
  HelpIcon,
  ManageSearch,
  MenuBookIcon,
} from '@/shared/components/Icons';
import { QuadraticLogo } from '@/shared/components/QuadraticLogo';
import { Button } from '@/shared/shadcn/ui/button';
import { Tooltip, TooltipContent, TooltipPortal, TooltipTrigger } from '@/shared/shadcn/ui/tooltip';
import { TooltipProvider } from '@radix-ui/react-tooltip';
import { forwardRef, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useRecoilState } from 'recoil';

export const QuadraticSidebar = () => {
  const [, setEditorInteractionState] = useRecoilState(editorInteractionStateAtom);
  const gridSettings = useGridSettings();

  return (
    <TooltipProvider>
      <nav className="flex h-full w-12 flex-col border-r border-border bg-accent">
        <SidebarTooltip label="Back to dashboard">
          <Link
            to="/"
            className="hover flex h-12 items-center justify-center border-b border-border text-muted-foreground"
          >
            <QuadraticLogo />
          </Link>
        </SidebarTooltip>
        <div className="mt-2">
          <SidebarTooltip label="Insert code cell" shortcut={'/'}>
            <SidebarButton onClick={() => setEditorInteractionState((prev) => ({ ...prev, showCellTypeMenu: true }))}>
              <CodeIcon />
            </SidebarButton>
          </SidebarTooltip>
          <SidebarTooltip label={(gridSettings.showCellTypeOutlines ? 'Hide' : 'Show') + ' code cell outlines'}>
            <SidebarButton onClick={() => gridSettings.setShowCellTypeOutlines(!gridSettings.showCellTypeOutlines)}>
              {gridSettings.showCellTypeOutlines ? <CodeCellOutlineOn /> : <CodeCellOutlineOff />}
            </SidebarButton>
          </SidebarTooltip>
          <SidebarTooltip label="Command palette" shortcut={KeyboardSymbols.Command + 'P'}>
            <SidebarButton onClick={() => setEditorInteractionState((prev) => ({ ...prev, showCommandPalette: true }))}>
              <ManageSearch />
            </SidebarButton>
          </SidebarTooltip>
        </div>
        <div className="mt-auto">
          <SidebarTooltip label="Help">
            <SidebarButton onClick={() => {}}>
              <HelpIcon />
            </SidebarButton>
          </SidebarTooltip>
          <SidebarTooltip label="Documentation">
            <SidebarButton onClick={() => setEditorInteractionState((prev) => ({ ...prev, showFeedbackMenu: true }))}>
              <MenuBookIcon />
            </SidebarButton>
          </SidebarTooltip>
          <SidebarTooltip label="Feedback">
            <SidebarButton onClick={() => setEditorInteractionState((prev) => ({ ...prev, showFeedbackMenu: true }))}>
              <FeedbackIcon />
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
