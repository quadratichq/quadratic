import { sidebarItemClasses } from '@/dashboard/components/DashboardSidebar';
import { useDashboardRouteLoaderData } from '@/routes/_dashboard';
import { TeamAction } from '@/routes/teams.$teamUuid';
import { AddIcon, ArrowDropDownIcon, CheckIcon, RefreshIcon } from '@/shared/components/Icons';
import { Type } from '@/shared/components/Type';
import { ROUTES } from '@/shared/constants/routes';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/shadcn/ui/dropdown-menu';
import { cn } from '@/shared/shadcn/utils';
import { isJsonObject } from '@/shared/utils/isJsonObject';
import { ReactNode } from 'react';
import { Link, useFetcher, useNavigate } from 'react-router-dom';

type Props = {
  appIsLoading: boolean;
};

export function TeamSwitcher({ appIsLoading }: Props) {
  const { teams } = useDashboardRouteLoaderData();
  const {
    activeTeam: {
      team: { name: activeTeamName, uuid: activeTeamUuid },
    },
  } = useDashboardRouteLoaderData();
  const fetcher = useFetcher({ key: 'update-team' });
  const navigate = useNavigate();

  const optimisticActiveTeamName =
    fetcher.state !== 'idle' && isJsonObject(fetcher.json)
      ? (fetcher.json as TeamAction['request.update-team']).name
      : activeTeamName;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={cn(`gap-2 py-1 text-sm font-semibold`, sidebarItemClasses.base)}>
        <div className="mx-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded bg-foreground capitalize text-background">
          {activeTeamName.slice(0, 1)}
        </div>
        <div className="select-none truncate">{optimisticActiveTeamName}</div>
        <div className="relative ml-auto mr-0.5 flex items-center">
          <ArrowDropDownIcon />
          <RefreshIcon
            className={`absolute left-0 top-0 ml-auto animate-spin bg-accent text-primary transition-opacity ${
              appIsLoading ? '' : ' opacity-0'
            }`}
          />
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="min-w-72" align="start" alignOffset={-4}>
        {teams.map(({ team: { uuid, name }, users }) => {
          const isActive = activeTeamUuid === uuid;
          return (
            <DropdownMenuItem key={uuid} asChild>
              <Link
                to={ROUTES.TEAM(uuid)}
                className={`flex gap-3`}
                onClick={(e) => {
                  // If this is being opened in a new tab, don't bother changing
                  // because we're not switching the active team in the current app
                  const isNewTabOrWindow = e.ctrlKey || e.shiftKey || e.metaKey;
                  if (isNewTabOrWindow) {
                    return;
                  }
                }}
              >
                {/* <IconWrapper>
                  {isPaid ? <DotFilledIcon className="text-success" /> : <DotIcon className="text-warning" />}
                </IconWrapper> */}

                <IconWrapper
                  className={cn(
                    'h-5 w-5 rounded border border-border capitalize',
                    isActive && 'border-foreground bg-foreground text-background'
                  )}
                >
                  {name.slice(0, 1)}
                </IconWrapper>
                <div className="flex flex-col">
                  <div>{name}</div>
                  <Type variant="caption">
                    {users} member{users === 1 ? '' : 's'}
                  </Type>
                </div>
                <div className="ml-auto flex h-6 w-6 items-center justify-center">{isActive && <CheckIcon />}</div>
              </Link>
            </DropdownMenuItem>
          );
        })}

        <DropdownMenuSeparator />

        <DropdownMenuItem
          className="flex gap-3 text-muted-foreground"
          onClick={() => {
            navigate(ROUTES.TEAMS_CREATE);
          }}
        >
          <IconWrapper>
            <AddIcon />
          </IconWrapper>
          Create team
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function IconWrapper({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('flex h-6 w-6 items-center justify-center', className)}>{children}</div>;
}
