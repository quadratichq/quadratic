import { ThemePickerMenu } from '@/app/ui/components/ThemePickerMenu';
import { useIsOnPaidPlan } from '@/app/ui/hooks/useIsOnPaidPlan';
import { useDashboardRouteLoaderData } from '@/routes/_dashboard';
import { useRootRouteLoaderData } from '@/routes/_root';
import { getActionFileMove } from '@/routes/api.files.$uuid';
import { labFeatures } from '@/routes/labs';
import type { TeamAction } from '@/routes/teams.$teamUuid';
import { Avatar } from '@/shared/components/Avatar';
import {
  AddIcon,
  ArrowDropDownIcon,
  CheckIcon,
  DatabaseIcon,
  DraftIcon,
  EducationIcon,
  ExamplesIcon,
  ExternalLinkIcon,
  FilePrivateIcon,
  FileSharedWithMeIcon,
  GroupIcon,
  LabsIcon,
  LogoutIcon,
  RefreshIcon,
  SettingsIcon,
} from '@/shared/components/Icons';
import { TeamAvatar } from '@/shared/components/TeamAvatar';
import { Type } from '@/shared/components/Type';
import { TYPE } from '@/shared/constants/appConstants';
import { ROUTES, SEARCH_PARAMS } from '@/shared/constants/routes';
import { COMMUNITY_FORUMS, CONTACT_URL, DOCUMENTATION_URL } from '@/shared/constants/urls';
import { Badge } from '@/shared/shadcn/ui/badge';
import { Button } from '@/shared/shadcn/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/shadcn/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/shadcn/ui/tooltip';
import { cn } from '@/shared/shadcn/utils';
import { trackEvent } from '@/shared/utils/analyticsEvents';
import { isJsonObject } from '@/shared/utils/isJsonObject';
import { RocketIcon } from '@radix-ui/react-icons';
import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import {
  Link,
  NavLink,
  useFetcher,
  useLocation,
  useMatch,
  useNavigate,
  useNavigation,
  useSearchParams,
  useSubmit,
} from 'react-router';

/**
 * Dashboard Navbar
 */
export function DashboardSidebar({ isLoading }: { isLoading: boolean }) {
  const [, setSearchParams] = useSearchParams();
  const { loggedInUser } = useRootRouteLoaderData();
  const submit = useSubmit();
  const {
    userMakingRequest: { id: ownerUserId },
    eduStatus,
    activeTeam: {
      userMakingRequest: { teamPermissions },
      team: { uuid: activeTeamUuid },
      billing,
    },
  } = useDashboardRouteLoaderData();

  const isOnPaidPlan = useMemo(() => billing.status === 'ACTIVE', [billing.status]);

  const { setIsOnPaidPlan } = useIsOnPaidPlan();
  useEffect(() => {
    setIsOnPaidPlan(isOnPaidPlan);
  }, [isOnPaidPlan, setIsOnPaidPlan]);

  const isSettingsPage = useMatch('/teams/:teamId/settings');
  const canEditTeam = teamPermissions.includes('TEAM_EDIT');
  const classNameIcons = `mx-0.5 text-muted-foreground`;

  return (
    <nav className={`flex h-full flex-col gap-4 overflow-auto bg-accent`}>
      <div className="sticky top-0 z-10 flex flex-col bg-accent px-3 pt-3">
        <TeamSwitcher appIsLoading={isLoading} />
      </div>
      <div className={`flex flex-col px-3`}>
        <Type
          as="h3"
          variant="overline"
          className={`mb-2 mt-1 flex items-baseline justify-between indent-2 text-muted-foreground`}
        >
          Team
        </Type>
        <div className="grid gap-0.5">
          <div className="relative">
            <SidebarNavLink to={ROUTES.TEAM(activeTeamUuid)} dropTarget={canEditTeam ? null : undefined}>
              <DraftIcon className={classNameIcons} />
              Files
            </SidebarNavLink>
            {canEditTeam && (
              <SidebarNavLinkCreateButton isPrivate={false} teamUuid={activeTeamUuid}>
                New file
              </SidebarNavLinkCreateButton>
            )}
          </div>
          {canEditTeam && (
            <SidebarNavLink to={ROUTES.TEAM_CONNECTIONS(activeTeamUuid)}>
              <DatabaseIcon className={classNameIcons} />
              Connections
            </SidebarNavLink>
          )}
          <SidebarNavLink to={ROUTES.TEAM_MEMBERS(activeTeamUuid)}>
            <GroupIcon className={classNameIcons} />
            Members
          </SidebarNavLink>
          {canEditTeam && (
            <SidebarNavLink to={ROUTES.TEAM_SETTINGS(activeTeamUuid)}>
              <SettingsIcon className={classNameIcons} />
              Settings
            </SidebarNavLink>
          )}
        </div>

        <Type
          as="h3"
          variant="overline"
          className={`mb-2 mt-6 flex items-baseline justify-between indent-2 text-muted-foreground`}
        >
          Personal
        </Type>
        <div className="relative">
          <SidebarNavLink to={ROUTES.TEAM_FILES_PRIVATE(activeTeamUuid)} dropTarget={ownerUserId}>
            <FilePrivateIcon className={classNameIcons} />
            My files
          </SidebarNavLink>
          <SidebarNavLinkCreateButton isPrivate={true} teamUuid={activeTeamUuid}>
            New personal file
          </SidebarNavLinkCreateButton>
        </div>
        <SidebarNavLink to={ROUTES.FILES_SHARED_WITH_ME}>
          <FileSharedWithMeIcon className={classNameIcons} />
          Shared with me
        </SidebarNavLink>

        <Type
          as="h3"
          className={`${TYPE.overline} mb-2 mt-6 flex items-baseline justify-between indent-2 text-muted-foreground`}
        >
          Resources
        </Type>
        <div className="grid gap-0.5">
          {canEditTeam && (
            <SidebarNavLink to={ROUTES.EXAMPLES}>
              <ExamplesIcon className={classNameIcons} />
              Examples
            </SidebarNavLink>
          )}
          <SidebarNavLink to={DOCUMENTATION_URL} target="_blank">
            <ExternalLinkIcon className={classNameIcons} />
            Docs
          </SidebarNavLink>
          <SidebarNavLink to={COMMUNITY_FORUMS} target="_blank">
            <ExternalLinkIcon className={classNameIcons} />
            Forum
          </SidebarNavLink>
          <SidebarNavLink to={CONTACT_URL} target="_blank">
            <ExternalLinkIcon className={classNameIcons} />
            Contact us
          </SidebarNavLink>
        </div>
      </div>
      <div className="mt-auto flex flex-col gap-1 bg-accent px-3 pb-2">
        {!isOnPaidPlan && !isSettingsPage && (
          <div className="mb-2 flex flex-col gap-2 rounded-lg border border-border p-3 text-xs shadow-sm">
            <div className="flex gap-2">
              <RocketIcon className="h-5 w-5 text-primary" />
              <div className="flex flex-col">
                <span className="font-semibold">Upgrade to Quadratic Pro</span>
                <span className="text-muted-foreground">Get more AI messages, connections, and more.</span>
              </div>
            </div>

            <Button size="sm" className="w-full" asChild>
              <Link
                to={ROUTES.TEAM_SETTINGS(activeTeamUuid)}
                onClick={() => {
                  trackEvent('[DashboardSidebar].upgradeToProClicked', {
                    team_uuid: activeTeamUuid,
                  });
                }}
              >
                Upgrade to Pro
              </Link>
            </Button>
          </div>
        )}
        {eduStatus === 'ENROLLED' && (
          <SidebarNavLink
            to={`./?${SEARCH_PARAMS.DIALOG.KEY}=${SEARCH_PARAMS.DIALOG.VALUES.EDUCATION}`}
            onClick={(e) => {
              e.preventDefault();
              setSearchParams(
                (prev) => {
                  prev.set(SEARCH_PARAMS.DIALOG.KEY, SEARCH_PARAMS.DIALOG.VALUES.EDUCATION);
                  return prev;
                },
                { replace: true }
              );
            }}
          >
            <EducationIcon className={classNameIcons} />
            Education
            <Badge variant="secondary" className="ml-auto">
              Enrolled
            </Badge>
          </SidebarNavLink>
        )}
        {labFeatures.length > 0 && (
          <SidebarNavLink to="/labs">
            <LabsIcon className={classNameIcons} />
            Labs
          </SidebarNavLink>
        )}
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger className="relative flex min-w-0 flex-grow items-center gap-2 rounded bg-accent p-2 no-underline hover:brightness-95 hover:saturate-150 dark:hover:brightness-125 dark:hover:saturate-100">
              <Avatar src={loggedInUser?.picture} alt={loggedInUser?.name} size="xs">
                {loggedInUser?.name ? loggedInUser?.name : loggedInUser?.email}
              </Avatar>
              <p className={`truncate text-xs`}>{loggedInUser?.email}</p>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-60" side="top" align="start">
              <DropdownMenuItem disabled className="flex-col items-start">
                {loggedInUser?.name || 'You'}
                <span className="text-xs">{loggedInUser?.email}</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault();
                  submit(null, {
                    method: 'post',
                    action: ROUTES.LOGOUT,
                  });
                }}
              >
                <LogoutIcon className="mr-2 text-muted-foreground" /> Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <div className="flex flex-shrink-0 items-center">
            <ThemePickerMenu />
          </div>
        </div>
      </div>
    </nav>
  );
}

function SidebarNavLinkCreateButton({
  children,
  isPrivate,
  teamUuid,
}: {
  children: ReactNode;
  isPrivate: boolean;
  teamUuid: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          asChild
          variant="ghost"
          size="icon-sm"
          className="absolute right-2 top-1 ml-auto !bg-transparent opacity-30 hover:opacity-100"
        >
          <Link to={ROUTES.CREATE_FILE(teamUuid, { private: isPrivate })} reloadDocument>
            <AddIcon />
          </Link>
        </Button>
      </TooltipTrigger>
      <TooltipContent>{children}</TooltipContent>
    </Tooltip>
  );
}

const sidebarItemClasses = {
  base: `dark:hover:brightness-125 hover:brightness-95 hover:saturate-150 dark:hover:saturate-100 bg-accent relative flex items-center gap-2 p-2 no-underline rounded`,
  active: `bg-accent dark:brightness-125 brightness-95 saturate-150 dark:saturate-100`,
  dragging: `bg-primary text-primary-foreground`,
};

function SidebarNavLink({
  to,
  children,
  className,
  dropTarget,
  isLogo,
  onClick,
  target,
}: {
  to: string;
  children: ReactNode;
  className?: string;
  // number = assigning to a user, null = assigning to a team
  dropTarget?: number | null;
  isLogo?: boolean;
  onClick?: (event: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => void;
  target?: string;
}) {
  const location = useLocation();
  const navigation = useNavigation();
  const submit = useSubmit();
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  const isActive =
    // We're currently on this page and not navigating elsewhere
    (to === location.pathname && navigation.state !== 'loading') ||
    (to.includes('/connections') && location.pathname.includes('/connections') && navigation.state !== 'loading') ||
    // We're navigating to this page
    to === navigation.location?.pathname;

  const isDroppable = dropTarget !== undefined && to !== location.pathname;
  const dropProps = isDroppable
    ? {
        onDragLeave: (event: React.DragEvent<HTMLAnchorElement>) => {
          setIsDraggingOver(false);
        },
        onDragOver: (event: React.DragEvent<HTMLAnchorElement>) => {
          if (!event.dataTransfer.types.includes('application/quadratic-file-uuid')) return;

          event.preventDefault();
          event.dataTransfer.dropEffect = 'move';
          setIsDraggingOver(true);
        },
        onDrop: async (event: React.DragEvent<HTMLAnchorElement>) => {
          if (!event.dataTransfer.types.includes('application/quadratic-file-uuid')) return;

          event.preventDefault();
          const uuid = event.dataTransfer.getData('application/quadratic-file-uuid');
          setIsDraggingOver(false);
          const data = getActionFileMove(dropTarget);
          submit(data, {
            method: 'POST',
            action: ROUTES.API.FILE(uuid),
            encType: 'application/json',
            navigate: false,
            fetcherKey: `move-file:${uuid}`,
          });
        },
      }
    : {};

  const classes = cn(
    sidebarItemClasses.base,
    isActive && sidebarItemClasses.active,
    isDraggingOver && sidebarItemClasses.dragging,
    TYPE.body2,
    className
  );

  return (
    <NavLink
      to={to}
      className={classes}
      {...(onClick ? { onClick } : {})}
      {...(target ? { target } : {})}
      {...dropProps}
    >
      {children}
    </NavLink>
  );
}

type TeamSwitcherProps = {
  appIsLoading: boolean;
};

function TeamSwitcher({ appIsLoading }: TeamSwitcherProps) {
  const { teams } = useDashboardRouteLoaderData();
  const {
    activeTeam: {
      team: { name: activeTeamName, uuid: activeTeamUuid },
    },
  } = useDashboardRouteLoaderData();
  const fetcher = useFetcher({ key: 'update-team' });
  const navigate = useNavigate();

  let optimisticActiveTeamName = activeTeamName;
  if (fetcher.state !== 'idle' && isJsonObject(fetcher.json)) {
    const optimisticData = fetcher.json as TeamAction['request.update-team'];
    if (optimisticData.name) {
      optimisticActiveTeamName = optimisticData.name;
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={cn(`gap-2 py-1 text-sm font-semibold`, sidebarItemClasses.base)}>
        <div className="mx-0.5">
          <TeamAvatar name={optimisticActiveTeamName} />
        </div>
        <div className="select-none truncate">{optimisticActiveTeamName}</div>
        <div className="relative ml-auto mr-0.5 flex items-center">
          <ArrowDropDownIcon />
          <RefreshIcon
            className={`absolute left-0 top-0 ml-auto animate-spin bg-accent text-primary transition-opacity ${
              appIsLoading ? '' : 'opacity-0'
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
