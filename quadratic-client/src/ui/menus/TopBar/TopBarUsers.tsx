import { Avatar, AvatarGroup, useTheme } from '@mui/material';
import { useRootRouteLoaderData } from '../../../router';
import { colors } from '../../../theme/colors';
import { TooltipHint } from '../../components/TooltipHint';

export const TopBarUsers = () => {
  const theme = useTheme();
  const { user } = useRootRouteLoaderData();
  const displayName = user?.name ? user.name + ' (You)' : '(You)';
  const initial = user?.name ? user.name[0] : 'Y';

  return (
    <AvatarGroup sx={{ mr: theme.spacing(1), ml: theme.spacing(-0.5), alignSelf: 'center' }}>
      {user && <UserAvatar displayName={displayName} initial={initial} picture={user.picture || ''} />}
    </AvatarGroup>
  );
};

function UserAvatar({ displayName, initial, picture }: { displayName: string; initial: string; picture: string }) {
  return (
    <TooltipHint title={displayName}>
      <Avatar
        sx={{
          bgcolor: colors.quadraticSecondary,
          width: 24,
          height: 24,
          fontSize: '0.8rem',
        }}
        alt={displayName}
        src={picture}
      >
        {initial}
      </Avatar>
    </TooltipHint>
  );
}
