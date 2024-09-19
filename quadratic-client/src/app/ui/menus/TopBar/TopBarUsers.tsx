import { editorInteractionStateFollowAtom } from '@/app/atoms/editorInteractionStateAtom';
import { MULTIPLAYER_COLORS } from '@/app/gridGL/HTMLGrid/multiplayerCursor/multiplayerColors';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { getAuth0AvatarSrc } from '@/app/helpers/links';
import { colors } from '@/app/theme/colors';
import { useMultiplayerUsers } from '@/app/ui/menus/TopBar/useMultiplayerUsers';
import { multiplayer } from '@/app/web-workers/multiplayerWebWorker/multiplayer';
import { useRootRouteLoaderData } from '@/routes/_root';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/shadcn/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipPortal, TooltipTrigger } from '@/shared/shadcn/ui/tooltip';
import { displayInitials, displayName } from '@/shared/utils/userUtil';
import { Avatar, AvatarGroup } from '@mui/material';
import { EyeOpenIcon } from '@radix-ui/react-icons';
import { useCallback } from 'react';
import { useSubmit } from 'react-router-dom';
import { useRecoilValue, useSetRecoilState } from 'recoil';

const sharedAvatarSxProps = { width: 24, height: 24, fontSize: '.8125rem' };

export const TopBarUsers = () => {
  const submit = useSubmit();
  const { loggedInUser: user } = useRootRouteLoaderData();
  const follow = useRecoilValue(editorInteractionStateFollowAtom);
  const { users, followers } = useMultiplayerUsers();

  const anonymous = !user
    ? {
        index: multiplayer.index,
        colorString: MULTIPLAYER_COLORS[(multiplayer.index ?? 0) % MULTIPLAYER_COLORS.length],
      }
    : undefined;

  return (
    <>
      {/* TODO(ayush): create custom AvatarGroup component */}
      <AvatarGroup
        componentsProps={{ additionalAvatar: { sx: sharedAvatarSxProps } }}
        className="gap-1"
        sx={{
          alignSelf: 'center',
          alignItems: 'center',
          flexDirection: 'row',
          // Styles for the "+2" avatar
          '& > .MuiAvatar-root': { marginRight: '.25rem', backgroundColor: '#aaa', border: `2px solid #aaa` },
        }}
        max={5}
      >
        {
          <DropdownMenu>
            <DropdownMenuTrigger>
              <You
                displayName={displayName(user ?? anonymous, true)}
                initial={displayInitials(user ?? anonymous)}
                picture={user?.picture ?? ''}
                border={multiplayer.colorString ?? 'black'}
                bgColor={multiplayer.colorString}
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
        }
        {users.map((user) => {
          return (
            <UserAvatar
              key={user.session_id}
              displayName={displayName(user, false)}
              initial={displayInitials(user)}
              picture={user.image}
              border={user.colorString}
              sessionId={user.session_id}
              follow={follow === user.session_id}
              follower={followers.includes(user.session_id)}
              viewport={user.viewport}
              bgColor={user.colorString}
            />
          );
        })}
      </AvatarGroup>
    </>
  );
};

function You({
  displayName,
  initial,
  picture,
  border,
  bgColor,
}: {
  displayName: string;
  initial: string;
  picture: string;
  border: string;
  bgColor?: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Avatar
          sx={{
            bgcolor: bgColor ?? colors.quadraticSecondary,
            ...sharedAvatarSxProps,
          }}
          alt={displayName}
          src={getAuth0AvatarSrc(picture)}
          imgProps={{ crossOrigin: 'anonymous' }}
          style={{
            border: `2px solid ${border}`,
          }}
        >
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

function UserAvatar({
  displayName,
  initial,
  picture,
  border,
  sessionId,
  follow,
  follower,
  viewport,
  bgColor,
}: {
  displayName: string;
  initial: string;
  picture: string;
  border: string;
  sessionId: string;
  follow: boolean;
  follower: boolean;
  viewport: string;
  bgColor?: string;
}) {
  const setFollow = useSetRecoilState(editorInteractionStateFollowAtom);
  const handleFollow = useCallback(() => {
    // you cannot follow a user that is following you
    if (follower) return;
    if (follow) {
      multiplayer.sendFollow('');
      setFollow(undefined);
    } else {
      pixiApp.viewport.loadMultiplayerViewport(JSON.parse(viewport));
      multiplayer.sendFollow(sessionId);
      setFollow(sessionId);
    }
  }, [follow, follower, sessionId, setFollow, viewport]);
  return (
    <div className="relative hidden lg:block">
      <Tooltip>
        <TooltipTrigger asChild>
          <button onClick={handleFollow}>
            <div>
              <Avatar
                sx={{
                  bgcolor: bgColor ?? colors.quadraticSecondary,
                  ...sharedAvatarSxProps,
                  pointerEvents: 'auto',
                  cursor: 'pointer',
                  position: 'relative',
                }}
                alt={displayName}
                src={getAuth0AvatarSrc(picture)}
                imgProps={{ crossOrigin: 'anonymous' }}
                style={{
                  border: `2px solid ${border}`,
                }}
              >
                {initial}
              </Avatar>
            </div>
          </button>
        </TooltipTrigger>
        <TooltipPortal>
          <TooltipContent>
            <p>
              {displayName}{' '}
              <span className="opacity-70">
                ({follower ? 'following you' : `Click to ${follow ? 'unfollow' : 'follow'}`})
              </span>
            </p>
          </TooltipContent>
        </TooltipPortal>
      </Tooltip>
      {follow && (
        <div className="pointer-events-none absolute bottom-1 left-1/2 flex h-5  w-5 items-center justify-center rounded-full bg-white">
          <EyeOpenIcon />
        </div>
      )}
      {follower && (
        <div className="pointer-events-none absolute left-1/2 top-1 flex h-5  w-5 items-center justify-center rounded-full bg-white">
          <EyeOpenIcon />
        </div>
      )}
    </div>
  );
}
