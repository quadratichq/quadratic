import { editorInteractionStateAtom } from '@/atoms/editorInteractionStateAtom';
import { pixiApp } from '@/gridGL/pixiApp/PixiApp';
import { TooltipHint } from '@/ui/components/TooltipHint';
import { displayInitials, displayName } from '@/utils/userUtil';
import { Avatar, AvatarGroup, IconButton } from '@mui/material';
import { EyeOpenIcon } from '@radix-ui/react-icons';
import { useSetRecoilState } from 'recoil';
import { useRootRouteLoaderData } from '../../../router';
import { colors } from '../../../theme/colors';
import { useMultiplayerUsers } from './useMultiplayerUsers';

const sharedAvatarSxProps = { width: 24, height: 24, fontSize: '.8125rem' };

export const TopBarUsers = () => {
  const { loggedInUser: user } = useRootRouteLoaderData();
  const { users, follow } = useMultiplayerUsers();
  const usersWithoutFollow = users.filter((user) => user.session_id !== follow?.session_id);

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
        {user && (
          <div className={`ml-2`}>
            <You
              displayName={displayName(user, true)}
              initial={displayInitials(user)}
              picture={user.picture || ''}
              border={'black'}
            />
          </div>
        )}
        {follow && (
          <UserAvatar
            displayName={displayName(follow, false)}
            initial={displayInitials(follow)}
            picture={follow.image || ''}
            border={follow.colorString}
            sessionId={follow.session_id}
            follow={true}
            viewport={follow.viewport}
            bgColor={follow.colorString}
          />
        )}
        {usersWithoutFollow.map((user) => {
          return (
            <UserAvatar
              key={user.session_id}
              displayName={displayName(user, false)}
              initial={displayInitials(user)}
              picture={user.image}
              border={user.colorString}
              sessionId={user.session_id}
              follow={false}
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
  viewport,
  bgColor,
}: {
  displayName: string;
  initial: string;
  picture: string;
  border: string;
  sessionId: string;
  follow: boolean;
  viewport: string;
  bgColor?: string;
}) {
  const setEditorInteractionState = useSetRecoilState(editorInteractionStateAtom);
  const handleFollow = () => {
    setEditorInteractionState((prev) => {
      if (follow) {
        return { ...prev, follow: undefined };
      }
      pixiApp.loadMultiplayerViewport(JSON.parse(viewport));
      return { ...prev, follow: sessionId };
    });
  };

  return (
    <div className="relative">
      <TooltipHint title={displayName} shortcut={`Click to ${follow ? 'unfollow' : 'follow'}`}>
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
    </div>
  );
}
