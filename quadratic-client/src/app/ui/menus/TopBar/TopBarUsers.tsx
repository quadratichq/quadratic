import { editorInteractionStateAtom } from '@/app/atoms/editorInteractionStateAtom';
import { MULTIPLAYER_COLORS } from '@/app/gridGL/HTMLGrid/multiplayerCursor/multiplayerColors';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { TooltipHint } from '@/app/ui/components/TooltipHint';
import { multiplayer } from '@/app/web-workers/multiplayerWebWorker/multiplayer';
import { useRootRouteLoaderData } from '@/routes/_root';
import { getAuth0AvatarSrc } from '@/shared/utils/auth0UserImageSrc';
import { displayInitials, displayName } from '@/shared/utils/userUtil';
import { Avatar, AvatarGroup, IconButton } from '@mui/material';
import { EyeOpenIcon } from '@radix-ui/react-icons';
import { useRecoilValue, useSetRecoilState } from 'recoil';
import { colors } from '../../../theme/colors';
import { useMultiplayerUsers } from './useMultiplayerUsers';

const sharedAvatarSxProps = { width: 24, height: 24, fontSize: '.8125rem' };

export const TopBarUsers = () => {
  const { loggedInUser: user } = useRootRouteLoaderData();
  const editorInteractionState = useRecoilValue(editorInteractionStateAtom);
  const { users, followers } = useMultiplayerUsers();

  const anonymous = !user
    ? {
        index: multiplayer.index,
        colorString: MULTIPLAYER_COLORS[(multiplayer.index ?? 0) % MULTIPLAYER_COLORS.length],
      }
    : undefined;

  return (
    <>
      <AvatarGroup
        spacing={16}
        componentsProps={{ additionalAvatar: { sx: sharedAvatarSxProps } }}
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
          <div className={`ml-2`}>
            <You
              displayName={displayName(user ?? anonymous, true)}
              initial={displayInitials(user ?? anonymous)}
              picture={user?.picture ?? ''}
              border={multiplayer.colorString ?? 'black'}
              bgColor={multiplayer.colorString}
            />
          </div>
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
              follow={editorInteractionState.follow === user.session_id}
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
    <TooltipHint title={displayName}>
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
    </TooltipHint>
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
  const setEditorInteractionState = useSetRecoilState(editorInteractionStateAtom);
  const handleFollow = () => {
    // you cannot follow a user that is following you
    if (follower) return;
    setEditorInteractionState((prev) => {
      if (follow) {
        multiplayer.sendFollow('');
        return { ...prev, follow: undefined };
      }
      pixiApp.viewport.loadMultiplayerViewport(JSON.parse(viewport));
      multiplayer.sendFollow(sessionId);
      return { ...prev, follow: sessionId };
    });
  };
  return (
    <div className="relative">
      <TooltipHint
        title={displayName}
        shortcut={follower ? 'following you' : `Click to ${follow ? 'unfollow' : 'follow'}`}
      >
        <IconButton sx={{ borderRadius: 0, px: '.25rem' }} onClick={handleFollow}>
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
        </IconButton>
      </TooltipHint>
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
