import { EmailOutlined } from '@mui/icons-material';
import { Avatar, ButtonBase, Stack, useTheme } from '@mui/material';
import { AvatarWithLetters } from '../../components/AvatarWithLetters';
import { QDialog } from '../../components/QDialog';
import { ShareMenu } from '../../components/ShareMenu';

export function TeamShareMenu({ onClose, team }: { onClose: () => void; team: any }) {
  const theme = useTheme();

  return (
    <QDialog onClose={onClose}>
      <QDialog.Title>Share team “{team.name}”</QDialog.Title>
      <QDialog.Content>
        {/* <ShareMenu fetcherUrl={'test'} permission={'OWNER'} uuid={'1'} /> */}
        <ShareMenu.Wrapper>
          <ShareMenu.Invite onInvite={() => {}} userEmails={team.users.map(({ email }: any) => email)} />
          {team.users.map((user: any) => (
            <ShareMenu.ListItem
              key={user.email}
              avatar={
                user.isPending ? (
                  <Avatar sx={{ width: 24, height: 24, fontSize: '16px' }}>
                    <EmailOutlined fontSize="inherit" />
                  </Avatar>
                ) : (
                  <AvatarWithLetters sx={{ width: 24, height: 24, fontSize: '.875rem' }}>
                    {user.name ? user.name : user.email}
                  </AvatarWithLetters>
                )
              }
              primary={user.isPending ? user.email : user.name ? user.name : user.email}
              secondary={
                user.isPending ? (
                  <Stack direction="row" gap={theme.spacing(0.5)}>
                    Invite sent.{' '}
                    <ButtonBase sx={{ textDecoration: 'underline', fontSize: 'inherit', fontFamily: 'inherit' }}>
                      Resend
                    </ButtonBase>
                  </Stack>
                ) : user.name ? (
                  user.email
                ) : (
                  ''
                )
              }
              action={<ShareMenu.ListItemUserActions value={user.permission} setValue={() => {}} />}
            />
          ))}
        </ShareMenu.Wrapper>
      </QDialog.Content>
    </QDialog>
  );
}
