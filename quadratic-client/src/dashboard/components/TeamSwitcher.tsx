import { useDashboardRouteLoaderData } from '@/routes/_dashboard';
import { useRootRouteLoaderData } from '@/routes/_root';
import { TeamAction } from '@/routes/teams.$teamUuid';
import { AddIcon, ArrowDropDownIcon, CheckIcon, LogoutIcon, RefreshIcon } from '@/shared/components/Icons';
import { Type } from '@/shared/components/Type';
import { ROUTES } from '@/shared/constants/routes';
import { Button } from '@/shared/shadcn/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/shadcn/ui/dropdown-menu';
import { isJsonObject } from '@/shared/utils/isJsonObject';
import { ReactNode } from 'react';
import { Link, useFetcher, useNavigate, useSubmit } from 'react-router-dom';

type Props = {
  appIsLoading: boolean;
};

export function TeamSwitcher({ appIsLoading }: Props) {
  const submit = useSubmit();
  const { loggedInUser } = useRootRouteLoaderData();
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
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="flex justify-between px-3 font-semibold">
          <div className="select-none truncate">{optimisticActiveTeamName}</div>
          <div className="relative flex items-center">
            <ArrowDropDownIcon />
            <RefreshIcon
              className={`absolute left-0 top-0 ml-auto animate-spin bg-background text-primary transition-opacity ${
                appIsLoading ? '' : ' opacity-0'
              }`}
            />
          </div>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-72">
        <DropdownMenuLabel className="text-xs text-muted-foreground">{loggedInUser?.email}</DropdownMenuLabel>

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

                <IconWrapper>{isActive && <CheckIcon />}</IconWrapper>
                <div className="flex flex-col">
                  <div>{name}</div>
                  <Type variant="caption">
                    {users} member{users === 1 ? '' : 's'}
                  </Type>
                </div>
                {/* <div className="ml-auto flex h-6 w-6 items-center justify-center">
                  {isActive && <CheckCircledIcon />}
                </div> */}
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

        <DropdownMenuItem
          className="flex gap-3 text-muted-foreground"
          onClick={() => {
            submit('', { method: 'POST', action: ROUTES.LOGOUT });
          }}
        >
          <IconWrapper>
            <LogoutIcon />
          </IconWrapper>
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function IconWrapper({ children }: { children: ReactNode }) {
  return <div className="flex h-6 w-6 items-center justify-center">{children}</div>;
}
