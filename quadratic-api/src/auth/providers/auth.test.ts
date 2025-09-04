import { auth0Mock } from '../../tests/auth0Mock';
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

import { getUsers } from './auth';

describe('auth.ts', () => {
  it('finds existing users', async () => {
    const result = await getUsers([
      { id: 1, auth0Id: 'user1', email: 'user1@test.com' },
      { id: 2, auth0Id: 'user2', email: 'user2@test.com' },
    ]);
    expect(Object.keys(result).length).toEqual(2);
  });
  it('throws when looking up a user that does not exist', async () => {
    expect(getUsers([{ id: 3, auth0Id: 'user3', email: 'user3@test.com' }])).rejects.toThrow();
  });
});
