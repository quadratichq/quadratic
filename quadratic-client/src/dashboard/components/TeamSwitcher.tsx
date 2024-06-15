import { useDashboardContext, useDashboardRouteLoaderData } from '@/routes/_dashboard';
import { TeamAction } from '@/routes/teams.$teamUuid';
import { Type } from '@/shared/components/Type';
import { ROUTES, SEARCH_PARAMS } from '@/shared/constants/routes';
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
import { CaretSortIcon, CheckCircledIcon, ExitIcon, PlusIcon, ReloadIcon } from '@radix-ui/react-icons';
import { ReactNode } from 'react';
import { Link, useFetcher, useSearchParams, useSubmit } from 'react-router-dom';

type Props = {
  appIsLoading: boolean;
};

export function TeamSwitcher({ appIsLoading }: Props) {
  const [, setSearchParams] = useSearchParams();
  const submit = useSubmit();
  const { teams } = useDashboardRouteLoaderData();
  const {
    activeTeamUuid: [activeTeamUuid, setActiveTeamUuid],
  } = useDashboardContext();
  const fetcher = useFetcher({ key: 'update-team' });

  const activeTeam = teams.find(({ team }) => team.uuid === activeTeamUuid);

  const optimisticActiveTeamName =
    fetcher.state !== 'idle' && isJsonObject(fetcher.json)
      ? (fetcher.json as TeamAction['request.update-team']).name
      : activeTeam
      ? activeTeam.team.name
      : 'Select a team';

  // TODO: (connections) move this to the settings page
  //
  // {teamPermissions.includes('TEAM_BILLING_EDIT') && (
  //   <DropdownMenuItem
  //     onClick={() => {
  //       // Get the billing session URL
  //       apiClient.teams.billing.getPortalSessionUrl(team.uuid).then((data) => {
  //         window.location.href = data.url;
  //       });
  //     }}
  //   >
  //     Update billing
  //   </DropdownMenuItem>
  // )}

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="flex justify-between px-3 font-semibold">
          {optimisticActiveTeamName}
          <div className="relative">
            <CaretSortIcon />
            <ReloadIcon
              className={`absolute left-0 top-0 ml-auto mr-1 animate-spin bg-background text-primary transition-opacity ${
                appIsLoading ? '' : ' opacity-0'
              }`}
            />
          </div>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-72">
        <DropdownMenuLabel className="text-xs text-muted-foreground">jim.nielsen@quadratichq.com</DropdownMenuLabel>

        {teams.map(({ team: { uuid, name } }: any) => {
          const isActive = activeTeamUuid === uuid;

          // TODO: (connections) get these from the API
          const memberCount = 1;
          const isPaid = false;

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

                  setActiveTeamUuid(uuid);
                }}
              >
                {/* <IconWrapper>
                  {isPaid ? <DotFilledIcon className="text-success" /> : <DotIcon className="text-warning" />}
                </IconWrapper> */}

                <IconWrapper>{isActive && <CheckCircledIcon />}</IconWrapper>
                <div className="flex flex-col">
                  <div>{name}</div>
                  <Type variant="caption">
                    {isPaid ? 'Paid' : 'Free'} · {memberCount} member{memberCount === 1 ? '' : 's'}
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
            setSearchParams(
              (prev) => {
                prev.set(SEARCH_PARAMS.DIALOG.KEY, SEARCH_PARAMS.DIALOG.VALUES.CREATE_TEAM);
                return prev;
              },
              { replace: true }
            );
          }}
        >
          <IconWrapper>
            <PlusIcon />
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
            <ExitIcon />
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
