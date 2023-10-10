import { PermissionSchema } from '../api/types';
import { getUserShareOptions } from './ShareMenu.utils';
const { OWNER, EDITOR, VIEWER } = PermissionSchema.enum;

const USERS = {
  OWNER: { email: 'jim.nielsen@example.com', permission: OWNER },
  EDITOR: { email: 'david.kircos@example.com', permission: EDITOR },
  VIEWER: { email: 'peter.mills@example.com', permission: VIEWER },

  OWNER2: { email: 'michael.jordan@example.com', permission: OWNER },
  EDITOR2: { email: 'tiger.woods@example.com', permission: EDITOR },
  VIEWER2: { email: 'joe.montana@example.com', permission: VIEWER },
};
const users = [USERS.OWNER, USERS.EDITOR, USERS.VIEWER];

describe('share team for an OWNER', () => {
  it('themselves (only one owner)', async () => {
    const result = getUserShareOptions({
      users,
      loggedInUser: USERS.OWNER,
      user: USERS.OWNER,
    });
    expect(result).toStrictEqual(['Owner']);
  });
  it('themselves (multiple owners)', async () => {
    const result = getUserShareOptions({
      users: [...users, USERS.OWNER2],
      loggedInUser: USERS.OWNER,
      user: USERS.OWNER,
    });
    expect(result).toStrictEqual(['Owner', 'Can edit', 'Can view', 'Leave']);
  });
  it('another owner', async () => {
    const result = getUserShareOptions({
      users: [...users, USERS.OWNER2],
      loggedInUser: USERS.OWNER,
      user: USERS.OWNER2,
    });
    expect(result).toStrictEqual(['Owner', 'Can edit', 'Can view', 'Remove']);
  });
  it('editor', async () => {
    const result = getUserShareOptions({ users, loggedInUser: USERS.OWNER, user: USERS.EDITOR });
    expect(result).toStrictEqual(['Owner', 'Can edit', 'Can view', 'Remove']);
  });
  it('viewer', async () => {
    const result = getUserShareOptions({ users, loggedInUser: USERS.OWNER, user: USERS.VIEWER });
    expect(result).toStrictEqual(['Owner', 'Can edit', 'Can view', 'Remove']);
  });
});

describe('share team for an EDITOR', () => {
  it('owner', async () => {
    const result = getUserShareOptions({ users, loggedInUser: USERS.EDITOR, user: USERS.OWNER });
    expect(result).toStrictEqual(['Owner']);
  });
  it('themselves', async () => {
    const result = getUserShareOptions({ users, loggedInUser: USERS.EDITOR, user: USERS.EDITOR });
    expect(result).toStrictEqual(['Can edit', 'Can view', 'Leave']);
  });
  it('another editor', async () => {
    const result = getUserShareOptions({ users, loggedInUser: USERS.EDITOR, user: USERS.EDITOR2 });
    expect(result).toStrictEqual(['Can edit', 'Can view', 'Remove']);
  });
  it('viewer', async () => {
    const result = getUserShareOptions({ users, loggedInUser: USERS.EDITOR, user: USERS.VIEWER });
    expect(result).toStrictEqual(['Can edit', 'Can view', 'Remove']);
  });
});

describe('share team for an VIEWER', () => {
  it('owner', async () => {
    const result = getUserShareOptions({ users, loggedInUser: USERS.VIEWER, user: USERS.OWNER });
    expect(result).toStrictEqual(['Owner']);
  });
  it('editor', async () => {
    const result = getUserShareOptions({ users, loggedInUser: USERS.VIEWER, user: USERS.EDITOR });
    expect(result).toStrictEqual(['Can edit']);
  });
  it('themselves', async () => {
    const result = getUserShareOptions({ users, loggedInUser: USERS.VIEWER, user: USERS.VIEWER });
    expect(result).toStrictEqual(['Can view', 'Leave']);
  });
  it('another viewer', async () => {
    const result = getUserShareOptions({ users, loggedInUser: USERS.VIEWER, user: USERS.VIEWER2 });
    expect(result).toStrictEqual(['Can view']);
  });
});
