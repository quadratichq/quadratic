import { editorInteractionStateAtom } from '@/atoms/editorInteractionStateAtom';
import { pixiApp } from '@/gridGL/pixiApp/PixiApp';
import { MULTIPLAYER_COLORS } from '@/multiplayer/multiplayerCursor/multiplayerColors';
import { TooltipHint } from '@/ui/components/TooltipHint';
import VisibilityIcon from '@mui/icons-material/Visibility';
import { Avatar, AvatarGroup, IconButton, useTheme } from '@mui/material';
import { Menu, MenuItem } from '@szhsin/react-menu';
import { useRecoilValue, useSetRecoilState } from 'recoil';
import { useRootRouteLoaderData } from '../../../router';
import { colors } from '../../../theme/colors';
import { useMultiplayerUsers } from './useMultiplayerUsers';

const convertName = (
  firstName: string | undefined,
  lastName: string | undefined,
  email: string | undefined,
  you: boolean
): string => {
  let name = '';
  if (firstName) {
    name += firstName;
  }
  if (lastName) {
    if (firstName) name += ' ';
    name += lastName;
  }
  if (!firstName && !lastName && email) {
    name = email;
  }
  if (you) {
    if (name.length) {
      name += ' (You)';
    } else {
      name += '(You)';
    }
  }
  return name;
};

const convertInitial = (firstName?: string, lastName?: string, email?: string): string => {
  if (!firstName && !lastName && email) {
    return email[0];
  }
  return (firstName ? firstName[0] : '') + (lastName ? lastName[0] : '');
};

// const getDeviceName = (): string => {
//   let parser = new UAParser(window.navigator.userAgent);
//   let result = parser.getResult();
//   return result.device?.model || result.device?.type || '';
// }

export const TopBarUsers = () => {
  const editorInteractionState = useRecoilValue(editorInteractionStateAtom);
  const follow = editorInteractionState.follow;

  const theme = useTheme();
  const { user } = useRootRouteLoaderData();
  const displayName = convertName(user?.given_name, user?.family_name, user?.email, true);
  const initial = convertInitial(user?.given_name, user?.family_name);
  // const device = getDeviceName();
  // console.log(device)
  // console.log(window.navigator.userAgent)
  const multiplayerUsers = useMultiplayerUsers();

  const users = multiplayerUsers.filter((user) => user.session_id !== follow);
  const userFollow = (follow && multiplayerUsers.find((user) => user.session_id === follow)) || null;

  // todo: black should be quadratic black

  return (
    <>
      <AvatarGroup sx={{ mr: theme.spacing(1), ml: theme.spacing(-0.5), alignSelf: 'center' }}>
        {users.map((user) => {
          return (
            <UserAvatar
              key={user.session_id}
              displayName={convertName(user.first_name, user.last_name, user.email, false)}
              initial={convertInitial(user.first_name, user.last_name, user.email)}
              picture={user.image}
              border={MULTIPLAYER_COLORS[user.color]}
              sessionId={user.session_id}
              follow={false}
              viewport={user.viewport}
            />
          );
        })}
      </AvatarGroup>
      <AvatarGroup sx={{ mr: theme.spacing(1), ml: theme.spacing(-0.5), alignSelf: 'center' }}>
        {userFollow && (
          <UserAvatar
            displayName={convertName(userFollow.first_name, userFollow.last_name, userFollow.email, false)}
            initial={convertInitial(userFollow.first_name, userFollow.last_name, userFollow.email)}
            picture={userFollow.image || ''}
            border={MULTIPLAYER_COLORS[userFollow.color]}
            sessionId={userFollow.session_id}
            follow={true}
            viewport={userFollow.viewport}
          />
        )}
        {user && <You displayName={displayName} initial={initial} picture={user.picture || ''} border={'black'} />}
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
}: {
  displayName: string;
  initial: string;
  picture: string;
  border: string;
  sessionId: string;
  follow: boolean;
  viewport: string;
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
              bgcolor: colors.quadraticSecondary,
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
