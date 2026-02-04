import { loadingAtom } from '@/app/ai/atoms/aiAnalystAtoms';
import { editorInteractionStateFollowAtom } from '@/app/atoms/editorInteractionStateAtom';
import { MULTIPLAYER_COLORS } from '@/app/gridGL/HTMLGrid/multiplayerCursor/multiplayerColors';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { focusGrid } from '@/app/helpers/focusGrid';
import { useMultiplayerUsers } from '@/app/ui/menus/TopBar/useMultiplayerUsers';
import { multiplayer } from '@/app/web-workers/multiplayerWebWorker/multiplayer';
import { useRootRouteLoaderData } from '@/routes/_root';
import { Avatar } from '@/shared/components/Avatar';
import { AIIcon, ScheduledTasksIcon } from '@/shared/components/Icons';
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
import { useAtomValue } from 'jotai';
import { useEffect, useMemo, useState } from 'react';
import { useSubmit } from 'react-router';
import { useRecoilValue, useSetRecoilState } from 'recoil';

export const TopBarUsers = () => {
  const submit = useSubmit();
  const { loggedInUser } = useRootRouteLoaderData();
  const follow = useRecoilValue(editorInteractionStateFollowAtom);
  const setFollow = useSetRecoilState(editorInteractionStateFollowAtom);
  const { users, followers } = useMultiplayerUsers();
  const isAILoading = useAtomValue(loadingAtom);
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);

  // Sync AI user with multiplayer system
  useEffect(() => {
    multiplayer.setAIUser(isAILoading);
  }, [isAILoading]);

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

  // Get AI user from multiplayer system (it's added there when isAILoading is true)
  const aiUserFromMultiplayer = useMemo(() => {
    return users.find((user) => user.session_id === 'ai-analyst') || null;
  }, [users]);

  // Separate AI user from regular users - filter it out since it's handled separately
  const regularUsers = users
    .filter((user) => user.session_id !== 'ai-analyst')
    .map((user) => {
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
        isAI: false,
        handleFollow: () => handleFollow({ isFollowingYou, isBeingFollowedByYou, sessionId, viewport }),
      };
    });

  const aiUserDisplay = aiUserFromMultiplayer
    ? {
        email: aiUserFromMultiplayer.email,
        name: displayName(aiUserFromMultiplayer, false),
        initials: displayInitials(aiUserFromMultiplayer),
        avatarSrc: '/logo192.png',
        highlightColor: aiUserFromMultiplayer.colorString,
        sessionId: aiUserFromMultiplayer.session_id,
        viewport: aiUserFromMultiplayer.viewport,
        isBeingFollowedByYou: false,
        isFollowingYou: false,
        isScheduledRun: false,
        isAI: true,
        handleFollow: () => {
          // AI user cannot be followed
        },
      }
    : null;

  const visibleAvatarBtns = 4;
  // AI user doesn't count against the visible limit, so we have one less slot for regular users
  const maxRegularUsersVisible = aiUserDisplay ? visibleAvatarBtns - 1 : visibleAvatarBtns;
  const truncateUsers = regularUsers.length > maxRegularUsersVisible;
  let visibleRegularUsers = truncateUsers ? regularUsers.slice(0, maxRegularUsersVisible) : regularUsers;
  let extraUsers = truncateUsers ? regularUsers.slice(maxRegularUsersVisible) : [];
  let userYouAreFollowing = extraUsers.filter((user) => user.isBeingFollowedByYou);
  // If you follow someone in the dropdown, move them to the visible list of users
  if (userYouAreFollowing.length === 1) {
    visibleRegularUsers = visibleRegularUsers.concat(userYouAreFollowing);
    extraUsers = extraUsers.filter((user) => !user.isBeingFollowedByYou);
  }

  // Always include AI user last (leftmost position due to flex-row-reverse) if it exists
  const visibleUsers = aiUserDisplay ? [...visibleRegularUsers, aiUserDisplay] : visibleRegularUsers;

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
            isAI,
            handleFollow,
          }) => (
            <div className={cn('hidden lg:relative lg:flex lg:items-center')} key={sessionId}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button onClick={handleFollow} disabled={isFollowingYou || isAI}>
                    <UserAvatar
                      email={email}
                      name={name}
                      initials={initials}
                      avatarSrc={avatarSrc}
                      highlightColor={highlightColor}
                      isBeingFollowedByYou={isBeingFollowedByYou}
                      isFollowingYou={isFollowingYou}
                      isScheduledRun={isScheduledRun}
                      isAI={isAI}
                    />
                  </button>
                </TooltipTrigger>
                <TooltipPortal>
                  <TooltipContent>
                    <p>
                      {name}{' '}
                      {!isAI && (
                        <span className="opacity-60">
                          ({isFollowingYou ? 'following you' : `click to ${follow ? 'unfollow' : 'follow'}`})
                        </span>
                      )}
                      {isAI && <span className="opacity-60">(AI Analyst)</span>}
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
                  isAI,
                  handleFollow,
                }) => {
                  return (
                    <DropdownMenuItem
                      key={sessionId}
                      className={cn('flex w-full items-center gap-3 rounded p-2 text-sm', isAI && 'cursor-default')}
                      onClick={() => {
                        if (!isAI) {
                          handleFollow();
                          setIsPopoverOpen(false);
                        }
                      }}
                      disabled={isAI}
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
                        isAI={isAI}
                      />
                      <span className="truncate">{name}</span>
                      {isFollowingYou && (
                        <span className="ml-auto flex-shrink-0 text-xs text-muted-foreground">Following you</span>
                      )}
                      {isAI && <span className="ml-auto flex-shrink-0 text-xs text-muted-foreground">AI Analyst</span>}
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
  isAI,
}: {
  email: string;
  name: string;
  initials: string;
  avatarSrc: string;
  highlightColor: string;
  isBeingFollowedByYou: boolean;
  isFollowingYou: boolean;
  isScheduledRun: boolean;
  isAI?: boolean;
}) {
  return (
    <div data-testid={`top-bar-user-avatar-${email}`} className="relative">
      {isAI ? (
        <div
          className="flex h-6 w-6 items-center justify-center rounded-full"
          style={{
            backgroundColor: highlightColor,
            boxShadow: isBeingFollowedByYou ? `0 0 0 2px ${highlightColor}` : undefined,
          }}
        >
          <AIIcon className="relative top-[1px] text-white" />
        </div>
      ) : (
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
      )}

      {isScheduledRun && (
        <div className="absolute inset-0 flex items-center justify-center rounded-full bg-border">
          <ScheduledTasksIcon className="text-foreground" />
        </div>
      )}

      {!isScheduledRun &&
        (isFollowingYou || isBeingFollowedByYou ? (
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
        ))}
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
