import { ThemePickerMenu } from '@/app/ui/components/ThemePickerMenu';
import { useIsOnPaidPlan } from '@/app/ui/hooks/useIsOnPaidPlan';
import { DashboardSidebarFolderTree } from '@/dashboard/components/DashboardSidebarFolderTree';
import { useCreateFile } from '@/dashboard/hooks/useCreateFile';
import { useOwnershipDropTarget } from '@/dashboard/hooks/useFolderDragDrop';
import { useDashboardRouteLoaderData } from '@/routes/_dashboard';
import { useRootRouteLoaderData } from '@/routes/_root';
import { labFeatures } from '@/routes/labs';
import type { TeamAction } from '@/routes/teams.$teamUuid';
import { apiClient } from '@/shared/api/apiClient';
import { showUpgradeDialogAtom } from '@/shared/atom/showUpgradeDialogAtom';
import { Avatar } from '@/shared/components/Avatar';
import {
  AddIcon,
  ArrowDropDownIcon,
  CheckIcon,
  DatabaseIcon,
  EducationIcon,
  ExamplesIcon,
  ExternalLinkIcon,
  FolderIcon,
  FolderSpecialIcon,
  GroupIcon,
  HomeIcon,
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/shared/shadcn/ui/alert-dialog';
import { Badge } from '@/shared/shadcn/ui/badge';
import { Button } from '@/shared/shadcn/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/shadcn/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipPortal, TooltipTrigger } from '@/shared/shadcn/ui/tooltip';
import { cn } from '@/shared/shadcn/utils';
import { setActiveTeam } from '@/shared/utils/activeTeam';
import { trackEvent } from '@/shared/utils/analyticsEvents';
import { isJsonObject } from '@/shared/utils/isJsonObject';
import { RocketIcon } from '@radix-ui/react-icons';
import { useSetAtom } from 'jotai';
import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
    eduStatus,
    userMakingRequest: { id: userId },
    activeTeam: {
      userMakingRequest: { teamPermissions },
      team: { uuid: activeTeamUuid },
      billing,
    },
  } = useDashboardRouteLoaderData();
  const setShowUpgradeDialog = useSetAtom(showUpgradeDialogAtom);
  const isOnPaidPlan = useMemo(() => billing.status === 'ACTIVE', [billing.status]);

  const { setIsOnPaidPlan } = useIsOnPaidPlan();
  useEffect(() => {
    setIsOnPaidPlan(isOnPaidPlan);
  }, [isOnPaidPlan, setIsOnPaidPlan]);

  const isSettingsPage = useMatch('/teams/:teamId/settings');
  const canEditTeam = teamPermissions.includes('TEAM_EDIT');
  const classNameIcons = `mx-0.5 text-muted-foreground`;

  // Track whether the folder tree for each section has been revealed by drag-hovering
  const [dragRevealTeam, setDragRevealTeam] = useState(false);
  const [dragRevealPrivate, setDragRevealPrivate] = useState(false);

  // Reset both reveal flags when the drag operation ends.
  // Only listen for 'dragend' (not 'drop') because a capture-phase 'drop' listener
  // can cause React to unmount drag-revealed folder trees before their onDrop handlers fire.
  // 'dragend' fires after 'drop' is fully processed, so it's safe to reset here.
  useEffect(() => {
    const reset = () => {
      setDragRevealTeam(false);
      setDragRevealPrivate(false);
    };
    document.addEventListener('dragend', reset, true);
    return () => {
      document.removeEventListener('dragend', reset, true);
    };
  }, []);

  return (
    <nav className={`flex h-full flex-col gap-4 overflow-auto bg-accent`}>
      <div className="sticky top-0 z-10 flex flex-col bg-accent px-3 pt-3">
        <TeamSwitcher appIsLoading={isLoading} />
      </div>
      <div className={`flex flex-col px-3`}>
        <div className="grid gap-0.5">
          <div className="group relative">
            <SidebarNavLink to={ROUTES.TEAM_FILES(activeTeamUuid)} data-testid="dashboard-sidebar-team-files-link">
              <HomeIcon className={classNameIcons} />
              <span className="min-w-0 truncate">Home</span>
              {canEditTeam && <SidebarNavLinkCreateButton>New file</SidebarNavLinkCreateButton>}
            </SidebarNavLink>
          </div>
          <SidebarOwnershipDropZone
            className="mt-3"
            targetOwnerUserId={null}
            onDragReveal={() => setDragRevealTeam(true)}
          >
            <div className="group relative">
              <SidebarNavLink to={ROUTES.TEAM_DRIVE_TEAM(activeTeamUuid)}>
                <FolderIcon className={classNameIcons} />
                <span className="min-w-0 truncate">Team Files</span>
                {canEditTeam && (
                  <SidebarNavLinkCreateButton overrideIsPrivate={false} overrideFolderUuid={null}>
                    New file
                  </SidebarNavLinkCreateButton>
                )}
              </SidebarNavLink>
            </div>
          </SidebarOwnershipDropZone>
          <DashboardSidebarFolderTree
            teamUuid={activeTeamUuid}
            filter="team"
            userId={userId}
            forceShow={dragRevealTeam}
            canEditTeam={canEditTeam}
          />
          <SidebarOwnershipDropZone targetOwnerUserId={userId} onDragReveal={() => setDragRevealPrivate(true)}>
            <div className="group relative">
              <SidebarNavLink to={ROUTES.TEAM_DRIVE_PRIVATE(activeTeamUuid)}>
                <FolderSpecialIcon className={classNameIcons} />
                <span className="min-w-0 truncate">Personal Files</span>
                {canEditTeam && (
                  <SidebarNavLinkCreateButton overrideIsPrivate={true} overrideFolderUuid={null}>
                    New file
                  </SidebarNavLinkCreateButton>
                )}
              </SidebarNavLink>
            </div>
          </SidebarOwnershipDropZone>
          <DashboardSidebarFolderTree
            teamUuid={activeTeamUuid}
            filter="private"
            userId={userId}
            forceShow={dragRevealPrivate}
            canEditTeam={canEditTeam}
          />
          {canEditTeam && (
            <SidebarNavLink className="mt-3" to={ROUTES.TEAM_CONNECTIONS(activeTeamUuid)}>
              <DatabaseIcon className={classNameIcons} />
              Connections
            </SidebarNavLink>
          )}
          <SidebarNavLink className="mt-3" to={ROUTES.TEAM_MEMBERS(activeTeamUuid)}>
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
      </div>
      <div className="mt-auto flex flex-col gap-1 bg-accent px-3">
        <div className="grid gap-0.5">
          {canEditTeam && (
            <SidebarNavLink to={ROUTES.TEMPLATES}>
              <ExamplesIcon className={classNameIcons} />
              Templates
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
        {!isOnPaidPlan && !isSettingsPage && (
          <div className="flex flex-col gap-2 rounded-lg border border-border p-3 text-xs shadow-sm">
            <div className="flex gap-2">
              <RocketIcon className="h-5 w-5 text-primary" />
              <div className="flex flex-col">
                <span className="font-semibold">Upgrade to Quadratic Pro</span>
                <span className="text-muted-foreground">Get more AI messages, unlimited files, and more.</span>
              </div>
            </div>
            <Button
              size="sm"
              className="w-full"
              onClick={() => {
                trackEvent('[DashboardSidebar].upgradeToProClicked', {
                  team_uuid: activeTeamUuid,
                });
                setShowUpgradeDialog({ open: true, eventSource: 'DashboardSidebar' });
              }}
            >
              Upgrade to Pro
            </Button>
          </div>
        )}
      </div>
      <div className="sticky bottom-0 flex items-center gap-2 bg-accent px-3 pb-3">
        <DropdownMenu>
          <DropdownMenuTrigger className="relative flex min-w-0 flex-grow items-center gap-2 rounded bg-accent p-2 pl-2.5 no-underline hover:brightness-95 hover:saturate-150 dark:hover:brightness-125 dark:hover:saturate-100">
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
    </nav>
  );
}

function SidebarOwnershipDropZone({
  targetOwnerUserId,
  onDragReveal,
  children,
  className,
}: {
  targetOwnerUserId: number | null;
  onDragReveal?: () => void;
  children: ReactNode;
  className?: string;
}) {
  const { isOver, onDragOver, onDragLeave, onDrop } = useOwnershipDropTarget(targetOwnerUserId);

  // Reveal the folder tree after hovering with a drag for 500ms
  const revealTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stableOnDragReveal = useCallback(() => onDragReveal?.(), [onDragReveal]);

  useEffect(() => {
    if (isOver) {
      revealTimer.current = setTimeout(stableOnDragReveal, 500);
    }
    return () => {
      if (revealTimer.current) {
        clearTimeout(revealTimer.current);
        revealTimer.current = null;
      }
    };
  }, [isOver, stableOnDragReveal]);

  return (
    <div
      className={cn('rounded', isOver && 'border border-primary bg-primary/10 [&>a]:bg-transparent', className)}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {children}
    </div>
  );
}

function SidebarNavLinkCreateButton({
  children,
  overrideIsPrivate,
  overrideFolderUuid,
}: {
  children: ReactNode;
  /** When provided, forces `isPrivate` instead of deriving it from the current route. */
  overrideIsPrivate?: boolean;
  /** When provided, forces a specific folder (or `null` for root) instead of deriving it from the current route. */
  overrideFolderUuid?: string | null;
}) {
  const { createFile } = useCreateFile();

  const handleClick = () => {
    createFile({
      ...(overrideIsPrivate !== undefined ? { isPrivate: overrideIsPrivate } : {}),
      ...(overrideFolderUuid !== undefined ? { folderUuid: overrideFolderUuid } : {}),
    });
  };

  return (
    <div className="absolute right-3 top-1/2 ml-auto flex -translate-y-1/2 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            className="!bg-transparent text-muted-foreground hover:opacity-100"
            onClick={handleClick}
          >
            <AddIcon />
          </Button>
        </TooltipTrigger>
        <TooltipPortal>
          <TooltipContent>{children}</TooltipContent>
        </TooltipPortal>
      </Tooltip>
    </div>
  );
}

const sidebarItemClasses = {
  base: `w-full dark:hover:brightness-125 hover:brightness-95 hover:saturate-150 dark:hover:saturate-100 bg-accent relative flex items-center gap-2 p-2 no-underline rounded`,
  active: `bg-accent dark:brightness-125 brightness-95 saturate-150 dark:saturate-100`,
};

function SidebarNavLink({
  to,
  children,
  className,

  isLogo,
  onClick,
  target,
  'data-testid': dataTestId,
}: {
  to: string;
  children: ReactNode;
  className?: string;

  isLogo?: boolean;
  onClick?: (event: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => void;
  target?: string;
  'data-testid'?: string;
}) {
  const location = useLocation();
  const navigation = useNavigation();

  const isActive =
    // We're currently on this page and not navigating elsewhere
    (to === location.pathname && navigation.state !== 'loading') ||
    // We're navigating to this page
    to === navigation.location?.pathname;

  const classes = cn(sidebarItemClasses.base, isActive && sidebarItemClasses.active, TYPE.body2, className);

  return (
    <NavLink
      to={to}
      className={classes}
      {...(onClick ? { onClick } : {})}
      {...(target ? { target } : {})}
      {...(dataTestId ? { 'data-testid': dataTestId } : {})}
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

  let optimisticActiveTeamName = activeTeamName;
  if (fetcher.state !== 'idle' && isJsonObject(fetcher.json)) {
    const optimisticData = fetcher.json as TeamAction['request.update-team'];
    if (optimisticData.name) {
      optimisticActiveTeamName = optimisticData.name;
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        data-testid="team-switcher-button"
        className={cn(`gap-2 py-1 text-sm font-semibold`, sidebarItemClasses.base)}
      >
        <div className="mx-0.5">
          <TeamAvatar name={optimisticActiveTeamName} />
        </div>
        <div className="select-none truncate" data-testid="team-switcher-team-name">
          {optimisticActiveTeamName}
        </div>
        <div className="relative ml-auto mr-0.5 flex items-center">
          <ArrowDropDownIcon />
          <RefreshIcon
            className={`absolute left-0 top-0 ml-auto animate-spin bg-accent text-primary transition-opacity ${
              appIsLoading ? '' : 'opacity-0'
            }`}
          />
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="max-h-96 min-w-72 overflow-y-auto" align="start" alignOffset={-4}>
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

        <CreateTeamAlert>
          <DropdownMenuItem
            data-testid="create-team-button"
            className="flex gap-3 text-muted-foreground"
            onSelect={(e) => {
              e.preventDefault();
            }}
          >
            <IconWrapper>
              <AddIcon />
            </IconWrapper>
            Create team
          </DropdownMenuItem>
        </CreateTeamAlert>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function IconWrapper({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('flex h-6 w-6 items-center justify-center', className)}>{children}</div>;
}

function CreateTeamAlert({ children }: { children: ReactNode }) {
  const [loadState, setLoadState] = useState<'idle' | 'loading' | 'error'>('idle');
  const navigate = useNavigate();
  const isLoading = loadState === 'loading';

  const handleCreateTeam = async () => {
    setLoadState('loading');
    try {
      const newTeam = await apiClient.teams.create();
      setActiveTeam(newTeam.uuid);
      navigate(ROUTES.TEAM_ONBOARDING(newTeam.uuid));
    } catch (error) {
      setLoadState('error');
      return;
    }
  };
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>{children}</AlertDialogTrigger>
      <AlertDialogContent className="max-w-sm">
        <AlertDialogHeader>
          <GroupIcon size="lg" />
          <AlertDialogTitle>Teams in Quadratic</AlertDialogTitle>
          <AlertDialogDescription>
            Teams are a collaborative space for working with other people. Create a new team and answer a few onboarding
            questions to get started.
          </AlertDialogDescription>
          {loadState === 'error' && (
            <AlertDialogDescription className="text-destructive">
              Failed to create team. Try again.
            </AlertDialogDescription>
          )}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>Cancel</AlertDialogCancel>
          <AlertDialogAction asChild>
            <Button
              data-testid="create-team-button-submit"
              disabled={isLoading}
              loading={isLoading}
              onClick={(e) => {
                e.preventDefault();
                handleCreateTeam();
              }}
            >
              Create new team
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
