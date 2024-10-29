import { useDashboardRouteLoaderData } from '@/routes/_dashboard';
import { useRootRouteLoaderData } from '@/routes/_root';
import { TeamAction } from '@/routes/teams.$teamUuid';
import { Avatar } from '@/shared/components/Avatar';
import { AccountIcon, AddIcon, ArrowDropDownIcon, CheckIcon, LogoutIcon, RefreshIcon } from '@/shared/components/Icons';
import { Type } from '@/shared/components/Type';
import { TYPE } from '@/shared/constants/appConstants';
import { ROUTES } from '@/shared/constants/routes';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
      <DropdownMenuTrigger className="group flex items-center justify-between gap-2 rounded p-2 text-left hover:bg-border focus:outline-none ">
        <Avatar src={loggedInUser?.picture} alt={loggedInUser?.name}>
          {loggedInUser?.name}
        </Avatar>

        <div className={`flex flex-grow flex-col overflow-hidden`}>
          <span className="truncate text-sm font-semibold">{optimisticActiveTeamName}</span>
          {loggedInUser?.email && (
            <span className={`truncate ${TYPE.caption} text-muted-foreground`}>{loggedInUser?.email}</span>
          )}
        </div>

        <div className="relative flex items-center pr-1">
          <ArrowDropDownIcon className="text-muted-foreground group-hover:text-foreground" />
          <RefreshIcon
            className={`absolute left-0 top-0 ml-auto animate-spin bg-accent text-primary transition-opacity ${
              appIsLoading ? '' : ' opacity-0'
            }`}
          />
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-72">
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

        <DropdownMenuSeparator />

        <DropdownMenuItem asChild>
          <Link to={ROUTES.ACCOUNT} className="flex gap-3 text-muted-foreground">
            <IconWrapper>
              <AccountIcon />
            </IconWrapper>
            My account
          </Link>
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
