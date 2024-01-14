import { editorInteractionStateAtom } from '@/atoms/editorInteractionStateAtom';
import { pixiApp } from '@/gridGL/pixiApp/PixiApp';
import { TooltipHint } from '@/ui/components/TooltipHint';
import { displayInitials, displayName } from '@/utils/userUtil';
import VisibilityIcon from '@mui/icons-material/Visibility';
import { Avatar, AvatarGroup, IconButton, useTheme } from '@mui/material';
import { Menu, MenuItem } from '@szhsin/react-menu';
import { useSetRecoilState } from 'recoil';
import { useRootRouteLoaderData } from '../../../router';
import { colors } from '../../../theme/colors';
import { useMultiplayerUsers } from './useMultiplayerUsers';

export const TopBarUsers = () => {
  const theme = useTheme();
  const { loggedInUser: user } = useRootRouteLoaderData();
  const { users, follow } = useMultiplayerUsers();
  const usersWithoutFollow = users.filter((user) => user.session_id !== follow?.session_id);

  return (
    <>
      <AvatarGroup sx={{ mr: theme.spacing(1), ml: theme.spacing(-0.5), alignSelf: 'center' }}>
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
      <AvatarGroup sx={{ mr: theme.spacing(1), ml: theme.spacing(-0.5), alignSelf: 'center' }}>
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
    // IconButton was necessary for the tooltip to work
    <IconButton>
      <TooltipHint title={displayName}>
        <Avatar
          sx={{
            bgcolor: colors.quadraticSecondary,
            width: 24,
            height: 24,
            fontSize: '0.8rem',
          }}
          variant="square"
          alt={displayName}
          src={picture}
          style={{
            border: `2px solid ${border}`,
          }}
        >
          {initial}
        </Avatar>
      </TooltipHint>
    </IconButton>
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
    <IconButton style={{ borderRadius: 0 }}>
      <TooltipHint title={name} sx={{}}>
        <div style={{ position: 'relative' }}>
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
            variant="square"
            alt={displayName}
            src={picture}
            style={{
              border: `2px solid ${border}`,
            }}
          >
            {initial}
          </Avatar>
          {follow && (
            <VisibilityIcon
              sx={{ position: 'absolute', top: '-8px', left: '50%', width: '16px', height: '16px', color: 'black' }}
            />
          )}
        </div>
      </TooltipHint>
    </IconButton>
  );

  return (
    <Menu menuButton={avatar}>
      <MenuItem onClick={handleFollow}>{follow ? `Stop following ${displayName}` : `Follow ${displayName}`}</MenuItem>
    </Menu>
  );
}
