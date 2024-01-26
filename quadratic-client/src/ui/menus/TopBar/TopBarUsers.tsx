import { editorInteractionStateAtom } from '@/atoms/editorInteractionStateAtom';
import { pixiApp } from '@/gridGL/pixiApp/PixiApp';
import { multiplayer } from '@/multiplayer/multiplayer';
import { MultiplayerUser } from '@/multiplayer/multiplayerTypes';
import { TooltipHint } from '@/ui/components/TooltipHint';
import { displayInitials, displayName } from '@/utils/userUtil';
import { User } from '@auth0/auth0-spa-js';
import { Avatar, AvatarGroup, IconButton } from '@mui/material';
import { EyeOpenIcon } from '@radix-ui/react-icons';
import { useRecoilValue, useSetRecoilState } from 'recoil';
import { useRootRouteLoaderData } from '../../../router';
import { colors } from '../../../theme/colors';
import { useMultiplayerUsers } from './useMultiplayerUsers';

const sharedAvatarSxProps = { width: 24, height: 24, fontSize: '.8125rem' };

export const TopBarUsers = () => {
  const { loggedInUser: user } = useRootRouteLoaderData();
  const editorInteractionState = useRecoilValue(editorInteractionStateAtom);
  const { users, followers } = useMultiplayerUsers();
  const you = users.length === 0 ? user : users.find((u) => u.session_id === multiplayer.sessionId);
  console.log(you);
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
              displayName={displayName(you, true)}
              initial={displayInitials(you)}
              picture={(you as MultiplayerUser)?.image ?? (you as User)?.picture ?? ''}
              border={you?.colorString ?? 'black'}
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
}: {
  displayName: string;
  initial: string;
  picture: string;
  border: string;
}) {
  return (
    <TooltipHint title={displayName}>
      <Avatar
        sx={{
          bgcolor: colors.quadraticSecondary,
          ...sharedAvatarSxProps,
        }}
        alt={displayName}
        src={picture}
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
      pixiApp.loadMultiplayerViewport(JSON.parse(viewport));
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
              src={picture}
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
