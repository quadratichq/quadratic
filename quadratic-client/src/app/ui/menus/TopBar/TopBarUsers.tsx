import { editorInteractionStateFollowAtom } from '@/app/atoms/editorInteractionStateAtom';
import { MULTIPLAYER_COLORS } from '@/app/gridGL/HTMLGrid/multiplayerCursor/multiplayerColors';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { focusGrid } from '@/app/helpers/focusGrid';
import { useMultiplayerUsers } from '@/app/ui/menus/TopBar/useMultiplayerUsers';
import { multiplayer } from '@/app/web-workers/multiplayerWebWorker/multiplayer';
import { useRootRouteLoaderData } from '@/routes/_root';
import { Avatar } from '@/shared/components/Avatar';
import { MoreHorizIcon } from '@/shared/components/Icons';
import { Button } from '@/shared/shadcn/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/shadcn/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/shadcn/ui/popover';
import { Tooltip, TooltipContent, TooltipPortal, TooltipTrigger } from '@/shared/shadcn/ui/tooltip';
import { cn } from '@/shared/shadcn/utils';
import { displayInitials, displayName } from '@/shared/utils/userUtil';
import { useState } from 'react';
import { useSubmit } from 'react-router-dom';
import { useRecoilValue, useSetRecoilState } from 'recoil';

export const TopBarUsers = () => {
  const submit = useSubmit();
  const { loggedInUser: user } = useRootRouteLoaderData();
  const follow = useRecoilValue(editorInteractionStateFollowAtom);
  const setFollow = useSetRecoilState(editorInteractionStateFollowAtom);
  const { users, followers } = useMultiplayerUsers();
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);

  const anonymous = !user
    ? {
        index: multiplayer.index,
        colorString: MULTIPLAYER_COLORS[(multiplayer.index ?? 0) % MULTIPLAYER_COLORS.length],
      }
    : undefined;

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

    return {
      name: displayName(user, false),
      initials: displayInitials(user),
      avatarSrc: user.image,
      highlightColor: user.colorString,
      sessionId,
      viewport,
      isBeingFollowedByYou,
      isFollowingYou,
      handleFollow: () => handleFollow({ isFollowingYou, isBeingFollowedByYou, sessionId, viewport }),
    };
  });

  const visibleAvatarBtns = 4;
  const truncateUsers = displayUsers.length > visibleAvatarBtns;
  const visibleUsers = truncateUsers ? displayUsers.slice(0, visibleAvatarBtns - 1) : displayUsers;
  const extraUsers = truncateUsers ? displayUsers.slice(visibleAvatarBtns - 1) : [];

  return (
    <>
      <div className="flex flex-row-reverse items-stretch gap-2 self-stretch">
        <DropdownMenu>
          <DropdownMenuTrigger className="self-center">
            <You
              displayName={displayName(user ?? anonymous, true)}
              initial={displayInitials(user ?? anonymous)}
              picture={user?.picture ?? ''}
            />
          </DropdownMenuTrigger>
          <DropdownMenuContent className="text-sm">
            <DropdownMenuItem disabled>{user?.email}</DropdownMenuItem>
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
            name,
            initials,
            avatarSrc,
            highlightColor,
            sessionId,
            viewport,
            isBeingFollowedByYou,
            isFollowingYou,
            handleFollow,
          }) => (
            <div className={cn('hidden lg:relative lg:flex lg:items-center')}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button onClick={handleFollow} disabled={isFollowingYou}>
                    <UserAvatar
                      name={name}
                      initials={initials}
                      avatarSrc={avatarSrc}
                      highlightColor={highlightColor}
                      isBeingFollowedByYou={isBeingFollowedByYou}
                      isFollowingYou={isFollowingYou}
                    />
                  </button>
                </TooltipTrigger>
                <TooltipPortal>
                  <TooltipContent>
                    <p>
                      {name}{' '}
                      <span className="opacity-70">
                        ({isFollowingYou ? 'following you' : `Click to ${follow ? 'unfollow' : 'follow'}`})
                      </span>
                    </p>
                  </TooltipContent>
                </TooltipPortal>
              </Tooltip>
            </div>
          )
        )}
        {extraUsers.length > 0 && (
          <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                className="flex h-6 w-6 items-center justify-center self-center rounded-full p-0 text-xs font-normal text-muted-foreground"
              >
                <MoreHorizIcon />
              </Button>
            </PopoverTrigger>
            <PopoverContent
              className="max-h-64 w-64 overflow-auto p-1"
              onCloseAutoFocus={(e) => {
                e.preventDefault();
                focusGrid();
              }}
            >
              <ul className="flex flex-col">
                {extraUsers.map(
                  ({
                    name,
                    initials,
                    avatarSrc,
                    highlightColor,
                    sessionId,
                    viewport,
                    isBeingFollowedByYou,
                    isFollowingYou,
                    handleFollow,
                  }) => {
                    return (
                      <li>
                        <button
                          className={cn(
                            'flex w-full items-center gap-4 rounded p-2 text-sm',
                            !isFollowingYou && 'hover:bg-accent'
                          )}
                          onClick={() => {
                            handleFollow();
                            setIsPopoverOpen(false);
                          }}
                          disabled={isFollowingYou}
                        >
                          <UserAvatar
                            name={name}
                            initials={initials}
                            avatarSrc={avatarSrc}
                            highlightColor={highlightColor}
                            isBeingFollowedByYou={isBeingFollowedByYou}
                            isFollowingYou={isFollowingYou}
                          />
                          <span className={cn('truncate', isFollowingYou && 'text-muted-foreground')}>{name}</span>
                          {isBeingFollowedByYou && (
                            <span className="ml-auto text-xs text-muted-foreground">Following</span>
                          )}
                          {isFollowingYou && (
                            <span className="ml-auto text-xs text-muted-foreground">Following you</span>
                          )}
                        </button>
                      </li>
                    );
                  }
                )}
              </ul>
            </PopoverContent>
          </Popover>
        )}
      </div>
    </>
  );
};

function UserAvatar({
  name,
  initials,
  avatarSrc,
  highlightColor,
  isBeingFollowedByYou,
  isFollowingYou,
}: {
  name: string;
  initials: string;
  avatarSrc: string;
  highlightColor: string;
  isBeingFollowedByYou: boolean;
  isFollowingYou: boolean;
}) {
  return (
    <div className="relative">
      <Avatar
        alt={name}
        src={avatarSrc}
        className={cn(isBeingFollowedByYou && 'border border-background', isFollowingYou && 'opacity-50')}
        style={{
          boxShadow: isBeingFollowedByYou ? `0 0 0 2px ${highlightColor}` : undefined,
        }}
      >
        {initials}
      </Avatar>
      {!isFollowingYou && (
        <span
          className="absolute -bottom-0.5 -right-0.5 ml-auto h-3 w-3 rounded-full border-2 border-background"
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
