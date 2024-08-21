import { colors } from '@/app/theme/colors';
import { ConnectionsIcon, SharedWithMeIcon } from '@/dashboard/components/CustomRadixIcons';
import { TeamSwitcher } from '@/dashboard/components/TeamSwitcher';
import { useDashboardRouteLoaderData } from '@/routes/_dashboard';
import { useRootRouteLoaderData } from '@/routes/_root';
import { getActionFileMove } from '@/routes/api.files.$uuid';
import { Avatar } from '@/shared/components/Avatar';
import { Type } from '@/shared/components/Type';
import { TYPE } from '@/shared/constants/appConstants';
import { ROUTES, SEARCH_PARAMS } from '@/shared/constants/routes';
import { CONTACT_URL, DOCUMENTATION_URL } from '@/shared/constants/urls';
import { Badge } from '@/shared/shadcn/ui/badge';
import { Button } from '@/shared/shadcn/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/shadcn/ui/tooltip';
import { cn } from '@/shared/shadcn/utils';
import { getAuth0AvatarSrc } from '@/shared/utils/auth0UserImageSrc';
import { SchoolOutlined } from '@mui/icons-material';
import { ExternalLinkIcon, FileIcon, GearIcon, MixIcon, PersonIcon, PlusIcon } from '@radix-ui/react-icons';
import { ReactNode, useState } from 'react';
import { Link, NavLink, useLocation, useNavigation, useSearchParams, useSubmit } from 'react-router-dom';

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
  const classNameIcons = `mx-1 text-muted-foreground`;

  return (
    <nav className={`flex h-full flex-col gap-4 overflow-auto`}>
      <div className="sticky top-0 z-10 flex flex-col bg-background px-4 pt-4">
        <TeamSwitcher appIsLoading={isLoading} />
      </div>
      <div className={`flex flex-col px-4`}>
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
              <FileIcon className={classNameIcons} />
              Files
            </SidebarNavLink>
            {canEditTeam && <SidebarNavLinkCreateButton to={ROUTES.CREATE_FILE(activeTeamUuid)} />}
          </div>
          {canEditTeam && (
            <SidebarNavLink to={ROUTES.TEAM_CONNECTIONS(activeTeamUuid)}>
              <ConnectionsIcon className={classNameIcons} />
              Connections
            </SidebarNavLink>
          )}
          <SidebarNavLink to={ROUTES.TEAM_MEMBERS(activeTeamUuid)}>
            <PersonIcon className={classNameIcons} />
            Members
          </SidebarNavLink>
          {canEditTeam && (
            <SidebarNavLink to={ROUTES.TEAM_SETTINGS(activeTeamUuid)}>
              <GearIcon className={classNameIcons} />
              Settings
            </SidebarNavLink>
          )}
        </div>

        <Type
          as="h3"
          variant="overline"
          className={`mb-2 mt-6 flex items-baseline justify-between indent-2 text-muted-foreground`}
        >
          Private
        </Type>
        <div className="relative">
          <SidebarNavLink to={ROUTES.TEAM_FILES_PRIVATE(activeTeamUuid)} dropTarget={ownerUserId}>
            <FileIcon className={classNameIcons} />
            Files
          </SidebarNavLink>
          <SidebarNavLinkCreateButton to={ROUTES.CREATE_FILE_PRIVATE(activeTeamUuid)} />
        </div>
        <SidebarNavLink to={ROUTES.FILES_SHARED_WITH_ME}>
          <SharedWithMeIcon className={classNameIcons} />
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
              <MixIcon className={classNameIcons} />
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
      <div className="mt-auto flex flex-col gap-1 bg-background px-4 pb-2">
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
            <SchoolOutlined sx={{ fontSize: '16px' }} className={classNameIcons} />
            Education
            <Badge variant="secondary" className="ml-auto">
              Enrolled
            </Badge>
          </SidebarNavLink>
        )}
        <SidebarNavLink to={ROUTES.ACCOUNT}>
          <Avatar
            src={getAuth0AvatarSrc(user?.picture)}
            alt={user?.name}
            crossOrigin="anonymous"
            style={{
              width: '24px',
              height: '24px',
              fontSize: '.8125rem',
              borderRadius: '50%',
              backgroundColor: colors.quadraticSecondary,
            }}
          >
            {user?.name}
          </Avatar>

          <div className={`flex flex-col overflow-hidden`}>
            {user?.name || 'You'}
            {user?.email && <p className={`truncate ${TYPE.caption} text-muted-foreground`}>{user?.email}</p>}
          </div>
        </SidebarNavLink>
      </div>
    </nav>
  );
}

function SidebarNavLinkCreateButton({ to }: { to: string }) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon-sm" asChild>
            <Link to={to} className="absolute right-2 top-1 ml-auto opacity-30 hover:opacity-100">
              <PlusIcon />
            </Link>
          </Button>
        </TooltipTrigger>
        <TooltipContent>Create file</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

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
    isActive && !isLogo && 'bg-muted',
    !isLogo && 'hover:bg-accent',
    isDraggingOver && 'bg-primary text-primary-foreground',
    TYPE.body2,
    `relative flex items-center gap-2 p-2 no-underline rounded`,
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
