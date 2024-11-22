import { TeamSwitcher } from '@/dashboard/components/TeamSwitcher';
import { useDashboardRouteLoaderData } from '@/routes/_dashboard';
import { useRootRouteLoaderData } from '@/routes/_root';
import { getActionFileMove } from '@/routes/api.files.$uuid';
import { Avatar } from '@/shared/components/Avatar';
import {
  AddIcon,
  DatabaseIcon,
  DraftIcon,
  EducationIcon,
  ExamplesIcon,
  ExternalLinkIcon,
  FilePrivateIcon,
  FileSharedWithMeIcon,
  GroupIcon,
  LabsIcon,
  SettingsIcon,
} from '@/shared/components/Icons';
import { Type } from '@/shared/components/Type';
import { TYPE } from '@/shared/constants/appConstants';
import { ROUTES, SEARCH_PARAMS } from '@/shared/constants/routes';
import { CONTACT_URL, DOCUMENTATION_URL } from '@/shared/constants/urls';
import { Badge } from '@/shared/shadcn/ui/badge';
import { Button } from '@/shared/shadcn/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/shadcn/ui/tooltip';
import { cn } from '@/shared/shadcn/utils';
import { ReactNode, useState } from 'react';
import { Link, NavLink, useLocation, useNavigation, useSearchParams, useSubmit } from 'react-router-dom';

const SHOW_EXAMPLES = import.meta.env.VITE_STORAGE_TYPE !== 'file-system';

/**
 * Dashboard Navbar
 */
export function DashboardSidebar({ isLoading }: { isLoading: boolean }) {
  const [, setSearchParams] = useSearchParams();
  const { loggedInUser: user } = useRootRouteLoaderData();
  const {
    userMakingRequest: { id: ownerUserId },
    eduStatus,
    activeTeam: {
      userMakingRequest: { teamPermissions },
      team: { uuid: activeTeamUuid },
    },
  } = useDashboardRouteLoaderData();

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
          {canEditTeam && SHOW_EXAMPLES && (
            <SidebarNavLink to={ROUTES.EXAMPLES}>
              <ExamplesIcon className={classNameIcons} />
              Examples
            </SidebarNavLink>
          )}
          <SidebarNavLink to={DOCUMENTATION_URL} target="_blank">
            <ExternalLinkIcon className={classNameIcons} />
            Docs
          </SidebarNavLink>
          <SidebarNavLink to={CONTACT_URL} target="_blank">
            <ExternalLinkIcon className={classNameIcons} />
            Contact us
          </SidebarNavLink>
        </div>
      </div>
      <div className="mt-auto flex flex-col gap-1 bg-accent px-3 pb-2">
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
        <SidebarNavLink to="/labs">
          <LabsIcon className={classNameIcons} />
          Labs
        </SidebarNavLink>
        <SidebarNavLink to="/account">
          <Avatar src={user?.picture} alt={user?.name}>
            {user?.name}
          </Avatar>

          <div className={`flex flex-col overflow-hidden text-left`}>
            {user?.name || 'You'}
            {user?.email && <p className={`truncate ${TYPE.caption} text-muted-foreground`}>{user?.email}</p>}
          </div>
        </SidebarNavLink>
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
          <Link to={isPrivate ? ROUTES.CREATE_FILE_PRIVATE(teamUuid) : ROUTES.CREATE_FILE(teamUuid)} reloadDocument>
            <AddIcon />
          </Link>
        </Button>
      </TooltipTrigger>
      <TooltipContent>{children}</TooltipContent>
    </Tooltip>
  );
}

export const sidebarItemClasses = {
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
