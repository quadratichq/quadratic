import { editorInteractionStateAtom } from '@/atoms/editorInteractionStateAtom';
import { pixiApp } from '@/gridGL/pixiApp/PixiApp';
import { TooltipHint } from '@/ui/components/TooltipHint';
import { displayInitials, displayName } from '@/utils/userUtil';
import { Avatar, AvatarGroup, IconButton } from '@mui/material';
import { EyeOpenIcon } from '@radix-ui/react-icons';
import { Menu, MenuItem } from '@szhsin/react-menu';
import { useSetRecoilState } from 'recoil';
import { useRootRouteLoaderData } from '../../../router';
import { colors } from '../../../theme/colors';
import { useMultiplayerUsers } from './useMultiplayerUsers';

export const TopBarUsers = () => {
  const { loggedInUser: user } = useRootRouteLoaderData();
  const { users, follow } = useMultiplayerUsers();
  const usersWithoutFollow = users.filter((user) => user.session_id !== follow?.session_id);

  return (
    <>
      <AvatarGroup sx={{ alignSelf: 'center' }}>
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
        {user && (
          <You
            displayName={displayName(user, true)}
            initial={displayInitials(user)}
            picture={user.picture || ''}
            border={'black'}
          />
        )}
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
    <div className="flex items-center px-2">
      <TooltipHint title={displayName}>
        <div>
          <Avatar
            sx={{
              bgcolor: colors.quadraticSecondary,
              width: 24,
              height: 24,
              fontSize: '0.8rem',
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
      </TooltipHint>
    </div>
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

  const name = follow ? `Following ${displayName}` : displayName;
  const avatar = (
    <div className="relative">
      <TooltipHint title={name}>
        <IconButton style={{ borderRadius: 0 }}>
          <div>
            <Avatar
              sx={{
                bgcolor: bgColor ?? colors.quadraticSecondary,
                width: 24,
                height: 24,
                fontSize: '0.8rem',
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

  return (
    <Menu menuButton={avatar}>
      <MenuItem onClick={handleFollow} style={{ fontSize: '.875rem' }}>
        {follow ? `Stop following ${displayName}` : `Follow ${displayName}`}
      </MenuItem>
    </Menu>
  );
}
