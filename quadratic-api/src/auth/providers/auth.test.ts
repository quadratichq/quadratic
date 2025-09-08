import { workosMock } from '../../tests/workosMock';
jest.mock('@workos-inc/node', () => workosMock([{ id: 'user1' }, { id: 'user2' }]));

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
