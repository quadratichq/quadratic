import { auth0Mock } from '../../tests/auth0Mock';
import { getUsersFromAuth0 } from './auth0';

jest.mock('auth0', () =>
  auth0Mock([
    {
      // `user_id` in Auth0 is `auth0Id` in our system
      user_id: 'user1',
      email: 'user2@example.com',
    },
    {
      user_id: 'user2',
      email: 'user2@example.com',
    },
  ])
);

describe('auth0.ts', () => {
  it('finds existing users', async () => {
    const result = await getUsersFromAuth0([
      { id: 1, auth0Id: 'user1' },
      { id: 2, auth0Id: 'user2' },
    ]);
    expect(Object.keys(result).length).toEqual(2);
  });
  it('throws when looking up a user that does not exist', async () => {
    expect(getUsersFromAuth0([{ id: 3, auth0Id: 'user3' }])).rejects.toThrow();
  });
});
