import { useEffect, useState } from 'react';
import { useFetcher } from 'react-router-dom';
import { QDialog } from '../../components/QDialog';
import { ShareMenu } from '../../components/ShareMenu';
import { Action } from '../TeamRoute';

export function TeamShareMenu({ onClose, team }: { onClose: () => void; team: any }) {
  // const theme = useTheme();
  // const rootLoaderData = useRootRouteLoaderData();
  // const currentUser = rootLoaderData.user;

  const fetcher = useFetcher();

  // const [users, setUsers] = useState(team.users);
  const users = team.users;

  let [pendingUsers, setPendingUsers] = useState<{ email: string; role: string }[]>([]); // TODO types
  console.log(pendingUsers);
  const userEmails = users.map(({ email }: any) => email).concat(pendingUsers.map(({ email }: any) => email));
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
          <Share
            users={users}
            usersIndexForLoggedInUser={}
            isLoading={}
            error={}
            onAddUser={}
            onModifyUser={}
            onDeleteUser={}
            onResendUserInvite={}
          />
        */}

        <ShareMenu.Wrapper>
          <ShareMenu.Invite
            disabled={fetcher.state !== 'idle'}
            onInvite={async ({ email, role }) => {
              setPendingUsers((prev: any) => [...prev, { email, role }]);
              // const data: Action['request.invite-user'] = { action: 'invite-user', payload: { email, role } };
              // fetcher.submit(data, {
              //   method: 'POST',
              //   // action: `/api/teams/${teamUuid}/sharing`,
              //   encType: 'application/json',
              // });
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
          {users.map((user: any, i: number) => {
            // const fetcher = useFetcher();
            return (
              <ShareMenu.UserListItem
                key={user.email}
                users={users}
                loggedInUser={{
                  // TODO this needs to come from the app
                  id: 1,
                  role: 'OWNER',
                  access: ['TEAM_EDIT', 'TEAM_BILLING_EDIT', 'TEAM_DELETE'],
                }}
                user={user}
                onUpdateUser={() => {}}
                onDeleteUser={() => {}}
              />
            );
          })}
          {/* <ShareMenu.Users
            users={users}
            // usersIndexForLoggedInUser={users.findIndex((user: UserShare) => user.email === '')}
            onUpdateUser={(user: any) => {
              // setUsers((prevUsers: any ) =>
              //   prevUsers.map((prevUser: any) => {
              //     if (prevUser.email === user.email) {
              //       return { ...prevUser, ...user };
              //     } else {
              //       return prevUser;
              //     }
              //   })
              // );
            }}
            onDeleteUser={(user: any ) => {
              console.log(user);
              // setUsers((prevUsers: any) =>
              //   prevUsers.filter((prevUser: any) => prevUser.email !== user.email)
              // );
            }}
            // Current user and their relationship to the current team
            loggedInUser={{
              // TODO this needs to come from the app
              id: 1,
              role: 'OWNER',
              access: ['TEAM_EDIT', 'TEAM_BILLING_EDIT', 'TEAM_DELETE'],
            }}
          />*/}

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
              // primary={user.isPending ? user.email : user.name ? user.name : user.email}
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

// function Item({ user }) {
//   const fetcher = useFetcher();

//   // if deleting, return null

//   // user = { }
//   // secondary = {}
//   return <ShareMenu.UserListItem />
// }

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

  return (
    <ShareMenu.UserListItem
      key={email}
      users={[pendingUser]}
      // @ts-expect-error
      loggedInUser={{}}
      user={pendingUser}
      onUpdateUser={() => {}}
      onDeleteUser={() => {}}
      disabled={true}
    />
  );
}
