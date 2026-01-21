import { editorInteractionStateShowIsRunningAsyncActionAtom } from '@/app/atoms/editorInteractionStateAtom';
import { SidebarTooltip } from '@/app/ui/QuadraticSidebar';
import { SpinnerIcon } from '@/shared/components/Icons';
import { QuadraticLogo } from '@/shared/components/QuadraticLogo';
import { ShowAfter } from '@/shared/components/ShowAfter';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/shared/shadcn/ui/dropdown-menu';
import { Link } from 'react-router';
import { useRecoilValue } from 'recoil';

export function BackToDashboardLogo() {
  const isRunningAsyncAction = useRecoilValue(editorInteractionStateShowIsRunningAsyncActionAtom);
  return (
    <DropdownMenu>
      <SidebarTooltip label="Back to dashboard">
        <DropdownMenuTrigger asChild>
          <div
            className="group relative flex h-9 w-9 items-center justify-center rounded text-muted-foreground hover:bg-border"
            data-testid="back-to-dashboard-link"
          >
            <QuadraticLogo />
            {isRunningAsyncAction && (
              <ShowAfter delay={300}>
                <div className="absolute left-0 top-0 flex h-full w-full items-center justify-center bg-accent group-hover:hidden">
                  <SpinnerIcon className="text-primary" />
                </div>
              </ShowAfter>
            )}
          </div>
        </DropdownMenuTrigger>
      </SidebarTooltip>
      <DropdownMenuContent>
        <DropdownMenuItem>
          <Link to="/" reloadDocument>
            Back to dashboard
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator className="!block" />
        {['File', 'Edit', 'View', 'Insert', 'Format', 'Help'].map((item) => (
          <DropdownMenuSub key={item}>
            <DropdownMenuSubTrigger>{item}</DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem>Stuff here...</DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
