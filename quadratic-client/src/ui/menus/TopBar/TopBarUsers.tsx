import { MULTIPLAYER_COLORS } from '@/multiplayer/multiplayerCursor/multiplayerColors';
import { Avatar, AvatarGroup, useTheme } from '@mui/material';
import { useRootRouteLoaderData } from '../../../router';
import { colors } from '../../../theme/colors';
import { TooltipHint } from '../../components/TooltipHint';
import { useMultiplayerUsers } from './useMultiplayerUsers';

const convertName = (firstName: string | undefined, lastName: string | undefined, you: boolean): string => {
  let name = '';
  if (firstName) {
    name += firstName;
  }
  if (lastName) {
    if (firstName) name += ' ';
    name += lastName;
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

const convertInitial = (firstName?: string, lastName?: string): string => {
  return (firstName ? firstName[0] : '') + (lastName ? lastName[0] : '');
};

// const getDeviceName = (): string => {
//   let parser = new UAParser(window.navigator.userAgent);
//   let result = parser.getResult();
//   return result.device?.model || result.device?.type || '';
// }

export const TopBarUsers = () => {
  const theme = useTheme();
  const { user } = useRootRouteLoaderData();
  const displayName = convertName(user?.given_name, user?.family_name, true);
  const initial = convertInitial(user?.given_name, user?.family_name);
  // const device = getDeviceName();
  // console.log(device)
  // console.log(window.navigator.userAgent)
  const multiplayerUsers = useMultiplayerUsers();

  // todo: black should be quadratic black

  return (
    <>
      <AvatarGroup sx={{ mr: theme.spacing(1), ml: theme.spacing(-0.5), alignSelf: 'center' }}>
        {multiplayerUsers.map((user) => {
          return (
            // <DropdownMenu>
            //   <DropdownMenuTrigger asChild>
                <UserAvatar
                  key={user.sessionId}
                  displayName={convertName(user.firstName, user.lastName, false)}
                  initial={convertInitial(user.firstName, user.lastName)}
                  picture={user.picture}
                  border={MULTIPLAYER_COLORS[user.color]}
                />
            //   </DropdownMenuTrigger>
            //   <DropdownMenuContent className="w-48">
            //     <DropdownMenuItem>Follow</DropdownMenuItem>
            //   </DropdownMenuContent>
            // </DropdownMenu>
          );
        })}
      </AvatarGroup>
      <AvatarGroup sx={{ mr: theme.spacing(1), ml: theme.spacing(-0.5), alignSelf: 'center' }}>
        {user && (
          <UserAvatar displayName={displayName} initial={initial} picture={user.picture || ''} border={'black'} />
        )}
      </AvatarGroup>
    </>
  );
};

function UserAvatar({
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
  );
}
