import { editorInteractionStateFollowAtom } from '@/app/atoms/editorInteractionStateAtom';
import { MULTIPLAYER_COLORS } from '@/app/gridGL/HTMLGrid/multiplayerCursor/multiplayerColors';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { focusGrid } from '@/app/helpers/focusGrid';
import { useMultiplayerUsers } from '@/app/ui/menus/TopBar/useMultiplayerUsers';
import { multiplayer } from '@/app/web-workers/multiplayerWebWorker/multiplayer';
import { useRootRouteLoaderData } from '@/routes/_root';
import { Avatar } from '@/shared/components/Avatar';
import { ScheduledTasksIcon } from '@/shared/components/Icons';
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
import { displayInitials, displayName } from '@/shared/utils/userUtil';
import { useMemo, useState } from 'react';
import { useSubmit } from 'react-router';
import { useRecoilValue, useSetRecoilState } from 'recoil';

export const TopBarUsers = () => {
  const submit = useSubmit();
  const { loggedInUser } = useRootRouteLoaderData();
  const follow = useRecoilValue(editorInteractionStateFollowAtom);
  const setFollow = useSetRecoilState(editorInteractionStateFollowAtom);
  const { users, followers } = useMultiplayerUsers();
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);

  const anonymous = useMemo(
    () =>
      !loggedInUser
        ? {
            index: multiplayer.index,
            colorString: MULTIPLAYER_COLORS[(multiplayer.index ?? 0) % MULTIPLAYER_COLORS.length],
          }
        : undefined,
    [loggedInUser]
  );

  const handleFollow = ({
    isFollowingYou,
    isBeingFollowedByYou,
    sessionId,
    viewport,
  }: {
    isFollowingYou: boolean;
    isBeingFollowedByYou: boolean;
    sessionId: string;
    viewport: string;
  }) => {
    // you cannot follow a user that is following you
    if (isFollowingYou) return;

    if (isBeingFollowedByYou) {
      multiplayer.sendFollow('');
      setFollow(undefined);
    } else {
      pixiApp.viewport.loadMultiplayerViewport(JSON.parse(viewport));
      multiplayer.sendFollow(sessionId);
      setFollow(sessionId);
    }
  };

  const displayUsers = users.map((user) => {
    const isBeingFollowedByYou = follow === user.session_id; // follow
    const isFollowingYou = followers.includes(user.session_id); // follower
    const sessionId = user.session_id;
    const viewport = user.viewport;
    const isScheduledRun = user.first_name === 'Quadratic' && user.last_name === 'Cloud Worker';

    return {
      email: user.email,
      name: displayName(user, false),
      initials: displayInitials(user),
      avatarSrc: user.image,
      highlightColor: user.colorString,
      sessionId,
      viewport,
      isBeingFollowedByYou,
      isFollowingYou,
      isScheduledRun,
      handleFollow: () => handleFollow({ isFollowingYou, isBeingFollowedByYou, sessionId, viewport }),
    };
  });

  const visibleAvatarBtns = 4;
  const truncateUsers = displayUsers.length > visibleAvatarBtns;
  let visibleUsers = truncateUsers ? displayUsers.slice(0, visibleAvatarBtns - 1) : displayUsers;
  let extraUsers = truncateUsers ? displayUsers.slice(visibleAvatarBtns - 1) : [];
  let userYouAreFollowing = extraUsers.filter((user) => user.isBeingFollowedByYou);
  // If you follow someone in the dropdown, move them to the visible list of users
  if (userYouAreFollowing.length === 1) {
    visibleUsers = visibleUsers.concat(userYouAreFollowing);
    extraUsers = extraUsers.filter((user) => !user.isBeingFollowedByYou);
  }

  return (
    <>
      <div className="flex flex-row-reverse items-stretch gap-2 self-stretch">
        <DropdownMenu>
          <DropdownMenuTrigger
            data-testid="top-bar-users-dropdown-trigger"
            className="self-center"
            disabled={Boolean(anonymous)}
          >
            <You
              displayName={displayName(loggedInUser ?? anonymous, true)}
              initial={displayInitials(loggedInUser ?? anonymous)}
              picture={loggedInUser?.picture ?? ''}
            />
          </DropdownMenuTrigger>
          <DropdownMenuContent className="text-sm">
            <DropdownMenuItem disabled>{loggedInUser?.email}</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => {
                submit(null, { action: '/logout', method: 'POST' });
              }}
            >
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        {visibleUsers.map(
          ({
            email,
            name,
            initials,
            avatarSrc,
            highlightColor,
            sessionId,
            viewport,
            isBeingFollowedByYou,
            isFollowingYou,
            isScheduledRun,
            handleFollow,
          }) => (
            <div className={cn('hidden lg:relative lg:flex lg:items-center')} key={sessionId}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button onClick={handleFollow} disabled={isFollowingYou}>
                    <UserAvatar
                      email={email}
                      name={name}
                      initials={initials}
                      avatarSrc={avatarSrc}
                      highlightColor={highlightColor}
                      isBeingFollowedByYou={isBeingFollowedByYou}
                      isFollowingYou={isFollowingYou}
                      isScheduledRun={isScheduledRun}
                    />
                  </button>
                </TooltipTrigger>
                <TooltipPortal>
                  <TooltipContent>
                    <p>
                      {name}{' '}
                      <span className="opacity-60">
                        ({isFollowingYou ? 'following you' : `click to ${follow ? 'unfollow' : 'follow'}`})
                      </span>
                    </p>
                  </TooltipContent>
                </TooltipPortal>
              </Tooltip>
            </div>
          )
        )}
        {extraUsers.length > 0 && (
          <DropdownMenu open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="hidden h-6 min-w-6 items-center justify-center self-center rounded-full p-0 text-sm font-normal text-muted-foreground hover:bg-transparent data-[state=open]:text-foreground lg:flex"
              >
                +{extraUsers.length}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              className="max-h-64 w-56 overflow-auto p-1"
              onCloseAutoFocus={(e) => {
                e.preventDefault();
                focusGrid();
              }}
            >
              {extraUsers.map(
                ({
                  email,
                  name,
                  initials,
                  avatarSrc,
                  highlightColor,
                  sessionId,
                  viewport,
                  isBeingFollowedByYou,
                  isFollowingYou,
                  isScheduledRun,
                  handleFollow,
                }) => {
                  return (
                    <DropdownMenuItem
                      key={sessionId}
                      className={cn('flex w-full items-center gap-3 rounded p-2 text-sm')}
                      onClick={() => {
                        handleFollow();
                        setIsPopoverOpen(false);
                      }}
                    >
                      <UserAvatar
                        email={email}
                        name={name}
                        initials={initials}
                        avatarSrc={avatarSrc}
                        highlightColor={highlightColor}
                        isBeingFollowedByYou={isBeingFollowedByYou}
                        isFollowingYou={isFollowingYou}
                        isScheduledRun={isScheduledRun}
                      />
                      <span className="truncate">{name}</span>
                      {isFollowingYou && (
                        <span className="ml-auto flex-shrink-0 text-xs text-muted-foreground">Following you</span>
                      )}
                    </DropdownMenuItem>
                  );
                }
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </>
  );
};

function UserAvatar({
  email,
  name,
  initials,
  avatarSrc,
  highlightColor,
  isBeingFollowedByYou,
  isFollowingYou,
  isScheduledRun,
}: {
  email: string;
  name: string;
  initials: string;
  avatarSrc: string;
  highlightColor: string;
  isBeingFollowedByYou: boolean;
  isFollowingYou: boolean;
  isScheduledRun: boolean;
}) {
  return (
    <div data-testid={`top-bar-user-avatar-${email}`} className="relative">
      <Avatar
        alt={name}
        src={avatarSrc}
        className={cn(isBeingFollowedByYou && 'border border-background')}
        style={{
          boxShadow: isBeingFollowedByYou ? `0 0 0 2px ${highlightColor}` : undefined,
        }}
      >
        {initials}
      </Avatar>

      {isScheduledRun && (
        <div
          className="absolute inset-0 flex items-center justify-center rounded-full"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.6)' }}
        >
          <ScheduledTasksIcon className="text-white" />
        </div>
      )}

      {isFollowingYou || isBeingFollowedByYou ? (
        <svg
          width="13"
          height="19"
          viewBox="0 0 13 19"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          style={{
            position: 'absolute',
            stroke: 'hsl(var(--background))',
            strokeWidth: '2px',
            right: '-6px',
            bottom: '-6px',
            width: '12px',
            transform: 'rotate(-14deg)',
          }}
        >
          <path
            d="M5.65376 12.3674H5.46026L5.31717 12.4977L0.5 16.883V1.19849L11.7841 12.3674H5.65376Z"
            fill={highlightColor}
          />
        </svg>
      ) : (
        <span
          className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-background"
          style={{ backgroundColor: highlightColor }}
        />
      )}
    </div>
  );
}

function You({ displayName, initial, picture }: { displayName: string; initial: string; picture: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Avatar alt={displayName} src={picture}>
          {initial}
        </Avatar>
      </TooltipTrigger>
      <TooltipPortal>
        <TooltipContent>
          <p>{displayName}</p>
        </TooltipContent>
      </TooltipPortal>
    </Tooltip>
  );
}
