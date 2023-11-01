import { useEffect, useState } from 'react';
import { useFetcher } from 'react-router-dom';
import { ApiTypes } from '../../api/types';
import { QDialog } from '../../components/QDialog';
import { ShareMenu } from '../../components/ShareMenu';
import { Action } from '../TeamRoute';

export function TeamShareMenu({
  onClose,
  data,
}: {
  onClose: () => void;
  data: ApiTypes['/v0/teams/:uuid.GET.response'];
}) {
  let [pendingUsers, setPendingUsers] = useState<{ email: string; role: string }[]>([]);
  const fetcher = useFetcher();

  const { team } = data;
  const users = team.users;
  const userEmails = users.map(({ email }) => email).concat(pendingUsers.map(({ email }) => email));
  const numberOfOwners = users.filter(({ role }) => role === 'OWNER').length;
  // if (fetcher.state !== 'idle' && !fetcher.data) {
  //   console.log(fetcher);
  //   const {
  //     payload: { email, role },
  //   } = fetcher.json as Action['request.invite-user'];
  //   users.push({ email, role });
  //   console.log(users);
  // }

  return (
    <QDialog onClose={onClose}>
      <QDialog.Title>Share team “{team.name}”</QDialog.Title>
      <QDialog.Content>
        {/* 
          TODO
          <ShareMenu>
            <ShareMenu.Invite />
            <ShareMenu.User />
        */}

        <ShareMenu.Wrapper>
          <ShareMenu.Invite
            disabled={fetcher.state !== 'idle'}
            onInvite={({ email, role }) => {
              setPendingUsers((prev) => [...prev, { email, role }]);
            }}
            userEmails={userEmails}
          />

          {pendingUsers.map((pendingUser: any) => (
            <PendingItem
              key={pendingUser.email}
              pendingUser={pendingUser}
              onComplete={() => {
                setPendingUsers((prev: any) => prev.filter((pu: any) => pu !== pendingUser));
              }}
            />
          ))}
          {users.map((user) => (
            <Item key={user.id} user={user} data={data} numberOfOwners={numberOfOwners} />
          ))}

          {/* 
              // avatar={
              //   user.isPending ? (
              //     <Avatar sx={{ width: 24, height: 24, fontSize: '16px' }}>
              //       <EmailOutlined fontSize="inherit" />
              //     </Avatar>
              //   ) : (
              //     <AvatarWithLetters
              //       src={user.picture ? user.picture : null}
              //       sx={{ width: 24, height: 24, fontSize: '.875rem' }}
              //     >
              //       {user.name ? user.name : user.email}
              //     </AvatarWithLetters>
              //   )
              // }
              
              // secondary={
              //   user.isPending ? (
              //     <Stack direction="row" gap={theme.spacing(0.5)}>
              //       Invite sent.{' '}
              //       <ButtonBase sx={{ textDecoration: 'underline', fontSize: 'inherit', fontFamily: 'inherit' }}>
              //         Resend
              //       </ButtonBase>
              //     </Stack>
              //   ) : user.name ? (
              //     user.email
              //   ) : (
              //     ''
              //   )
              // }
              // action={<ShareMenu.ListItemUserActions value={user.permission} setValue={() => {}} />}
        */}
        </ShareMenu.Wrapper>
      </QDialog.Content>
    </QDialog>
  );
}

function Item({
  user,
  numberOfOwners,
  data,
}: {
  user: ApiTypes['/v0/teams/:uuid.GET.response']['team']['users'][0];
  numberOfOwners: number;
  data: ApiTypes['/v0/teams/:uuid.GET.response'];
}) {
  const fetcher = useFetcher<Action['response']>();
  const json = fetcher.json as Action['request'] | undefined;

  // Optimistically hide when being deleted
  if (fetcher.state !== 'idle' && json?.action === 'delete-user') {
    return null;
  }

  // Optimistically update role when being updated
  if (fetcher.state !== 'idle' && json?.action === 'update-user') {
    user.role = json.payload.role;
  }

  // Show error if delete or update failed
  let error = '';
  if (fetcher.state === 'idle' && fetcher.data?.ok === false) {
    console.log(fetcher.data);
    error = `Failed to ${fetcher.data.action === 'delete-user' ? 'delete' : 'update'}`;
  }

  return (
    <ShareMenu.UserListItem
      key={user.id}
      error={error}
      numberOfOwners={numberOfOwners}
      loggedInUser={data.user}
      user={user}
      onUpdateUser={(id, role) => {
        const data: Action['request.update-user'] = { action: 'update-user', id, payload: { role } };
        fetcher.submit(data, { method: 'post', encType: 'application/json' });
      }}
      onDeleteUser={(id) => {
        const data: Action['request.delete-user'] = { action: 'delete-user', id };
        fetcher.submit(data, { method: 'post', encType: 'application/json' });
      }}
    />
  );
}

function PendingItem({ pendingUser, onComplete }: any) {
  const fetcher = useFetcher();
  let { email, role } = pendingUser;

  useEffect(() => {
    const data: Action['request.invite-user'] = { action: 'invite-user', payload: { email, role } };
    fetcher.submit(data, {
      method: 'POST',
      encType: 'application/json',
    });
    // We know we don't want this to re-run, so we'll disable
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (fetcher.state === 'idle' && fetcher.data) {
      onComplete();
    }
  }, [fetcher, onComplete]);

  // TODO better state for pending user

  return (
    <ShareMenu.UserListItem
      key={email}
      numberOfOwners={0}
      // @ts-expect-error
      loggedInUser={{}}
      user={pendingUser}
      onUpdateUser={() => {}}
      onDeleteUser={() => {}}
      disabled={true}
    />
  );
}
