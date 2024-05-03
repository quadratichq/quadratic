import { describe, expect, it } from 'vitest';
import { getUserShareOptions } from './ShareMenu.utils';

// A set of example users and would be returned by the API
const TEAM_USERS_BY_ROLE = {
  OWNER: {
    email: 'jim.nielsen@example.com',
    role: 'OWNER',
    access: ['TEAM_EDIT', 'TEAM_DELETE', 'BILLING_EDIT'],
  },
  EDITOR: { email: 'david.kircos@example.com', role: 'EDITOR', access: ['TEAM_EDIT'] },
  VIEWER: { email: 'peter.mills@example.com', role: 'VIEWER', access: ['TEAM_VIEW'] },

  OWNER_ALT: {
    email: 'michael.jordan@example.com',
    role: 'OWNER',
    access: ['TEAM_EDIT', 'TEAM_DELETE', 'BILLING_EDIT'],
  },
  EDITOR_ALT: { email: 'tiger.woods@example.com', role: 'EDITOR', access: ['TEAM_EDIT'] },
  VIEWER_ALT: { email: 'joe.montana@example.com', role: 'VIEWER', access: ['TEAM_VIEW'] },
};
const baseTeamUsers = [TEAM_USERS_BY_ROLE.OWNER, TEAM_USERS_BY_ROLE.EDITOR, TEAM_USERS_BY_ROLE.VIEWER];

describe('Share menu for the team OWNER', () => {
  it('Has only one option for themselves as team owner (if they’re the only team owner)', async () => {
    const result = getUserShareOptions({
      users: baseTeamUsers,
      loggedInUser: TEAM_USERS_BY_ROLE.OWNER,
      user: TEAM_USERS_BY_ROLE.OWNER,
    });
    expect(result).toStrictEqual(['Owner']);
  });
  it('Has multiple options for themselves as team owner (if there’s one or more other owners on the team)', async () => {
    const result = getUserShareOptions({
      users: [...baseTeamUsers, TEAM_USERS_BY_ROLE.OWNER_ALT],
      loggedInUser: TEAM_USERS_BY_ROLE.OWNER,
      user: TEAM_USERS_BY_ROLE.OWNER,
    });
    expect(result).toStrictEqual(['Owner', 'Can edit', 'Can view', 'Leave']);
  });
  it('Has the same options for other team owners, for editors, and for viewers', async () => {
    const resultOtherOwner = getUserShareOptions({
      users: [...baseTeamUsers, TEAM_USERS_BY_ROLE.OWNER_ALT],
      loggedInUser: TEAM_USERS_BY_ROLE.OWNER,
      user: TEAM_USERS_BY_ROLE.OWNER_ALT,
    });
    const resultEditor = getUserShareOptions({
      users: baseTeamUsers,
      loggedInUser: TEAM_USERS_BY_ROLE.OWNER,
      user: TEAM_USERS_BY_ROLE.EDITOR,
    });
    const resultViewer = getUserShareOptions({
      users: baseTeamUsers,
      loggedInUser: TEAM_USERS_BY_ROLE.OWNER,
      user: TEAM_USERS_BY_ROLE.VIEWER,
    });
    expect(resultOtherOwner).toStrictEqual(['Owner', 'Can edit', 'Can view', 'Remove']);
    expect(resultOtherOwner).toStrictEqual(resultEditor);
    expect(resultOtherOwner).toStrictEqual(resultViewer);
  });
});

describe('Share menu for a team EDITOR', () => {
  it('Has only one option for owners', async () => {
    const result = getUserShareOptions({
      users: baseTeamUsers,
      loggedInUser: TEAM_USERS_BY_ROLE.EDITOR,
      user: TEAM_USERS_BY_ROLE.OWNER,
    });
    expect(result).toStrictEqual(['Owner']);
  });
  it('Has multiple options for themselves as an editor', async () => {
    const result = getUserShareOptions({
      users: baseTeamUsers,
      loggedInUser: TEAM_USERS_BY_ROLE.EDITOR,
      user: TEAM_USERS_BY_ROLE.EDITOR,
    });
    expect(result).toStrictEqual(['Can edit', 'Can view', 'Leave']);
  });
  it('Has the same options for other editors and viewers', async () => {
    const resultEditor = getUserShareOptions({
      users: baseTeamUsers,
      loggedInUser: TEAM_USERS_BY_ROLE.EDITOR,
      user: TEAM_USERS_BY_ROLE.EDITOR_ALT,
    });
    const resultViewer = getUserShareOptions({
      users: baseTeamUsers,
      loggedInUser: TEAM_USERS_BY_ROLE.EDITOR,
      user: TEAM_USERS_BY_ROLE.VIEWER,
    });
    expect(resultEditor).toStrictEqual(['Can edit', 'Can view', 'Remove']);
    expect(resultEditor).toStrictEqual(resultViewer);
  });
});

describe('Share menu for a team VIEWER', () => {
  it('Has only one option for owners', async () => {
    const result = getUserShareOptions({
      users: baseTeamUsers,
      loggedInUser: TEAM_USERS_BY_ROLE.VIEWER,
      user: TEAM_USERS_BY_ROLE.OWNER,
    });
    expect(result).toStrictEqual(['Owner']);
  });
  it('Has only one option for editors', async () => {
    const result = getUserShareOptions({
      users: baseTeamUsers,
      loggedInUser: TEAM_USERS_BY_ROLE.VIEWER,
      user: TEAM_USERS_BY_ROLE.EDITOR,
    });
    expect(result).toStrictEqual(['Can edit']);
  });
  it('Has multiple options for themselves as a viewer', async () => {
    const result = getUserShareOptions({
      users: baseTeamUsers,
      loggedInUser: TEAM_USERS_BY_ROLE.VIEWER,
      user: TEAM_USERS_BY_ROLE.VIEWER,
    });
    expect(result).toStrictEqual(['Can view', 'Leave']);
  });
  it('Has only one option for other viewers', async () => {
    const result = getUserShareOptions({
      users: baseTeamUsers,
      loggedInUser: TEAM_USERS_BY_ROLE.VIEWER,
      user: TEAM_USERS_BY_ROLE.VIEWER_ALT,
    });
    expect(result).toStrictEqual(['Can view']);
  });
});

const FILE_USERS_BY_ROLE = {
  OWNER: {
    email: 'jim.nielsen@example.com',
    role: 'OWNER',
    access: ['FILE_EDIT', 'FILE_DELETE'],
  },
  EDITOR: { email: 'david.kircos@example.com', role: 'EDITOR', access: ['FILE_EDIT'] },
  VIEWER: { email: 'peter.mills@example.com', role: 'VIEWER', access: ['FILE_VIEW'] },

  EDITOR_ALT: { email: 'tiger.woods@example.com', role: 'EDITOR', access: ['FILE_EDIT'] },
  VIEWER_ALT: { email: 'joe.montana@example.com', role: 'VIEWER', access: ['FILE_VIEW'] },
};
const baseFileUsers = [FILE_USERS_BY_ROLE.OWNER, FILE_USERS_BY_ROLE.EDITOR, FILE_USERS_BY_ROLE.VIEWER];

describe('Share menu for a file OWNER', () => {
  it('Has only one option for themselves as file owner', async () => {
    const result = getUserShareOptions({
      users: baseFileUsers,
      loggedInUser: FILE_USERS_BY_ROLE.OWNER,
      user: FILE_USERS_BY_ROLE.OWNER,
    });
    expect(result).toStrictEqual(['Owner']);
  });
  it('Has the same options for editors and viewers', async () => {
    const resultEditor = getUserShareOptions({
      users: baseFileUsers,
      loggedInUser: FILE_USERS_BY_ROLE.OWNER,
      user: FILE_USERS_BY_ROLE.EDITOR,
    });
    const resultViewer = getUserShareOptions({
      users: baseFileUsers,
      loggedInUser: FILE_USERS_BY_ROLE.OWNER,
      user: FILE_USERS_BY_ROLE.VIEWER,
    });
    expect(resultEditor).toStrictEqual(['Owner', 'Can edit', 'Can view', 'Remove']);
    expect(resultEditor).toStrictEqual(resultViewer);
  });
});

describe('Share menu for a file EDITOR', () => {
  it('Has only one option for owners', async () => {
    const result = getUserShareOptions({
      users: baseFileUsers,
      loggedInUser: FILE_USERS_BY_ROLE.EDITOR,
      user: FILE_USERS_BY_ROLE.OWNER,
    });
    expect(result).toStrictEqual(['Owner']);
  });
  it('Has multiple options for themselves as an editor', async () => {
    const result = getUserShareOptions({
      users: baseFileUsers,
      loggedInUser: FILE_USERS_BY_ROLE.EDITOR,
      user: FILE_USERS_BY_ROLE.EDITOR,
    });
    expect(result).toStrictEqual(['Can edit', 'Can view', 'Leave']);
  });
  it('Has the same options for other editors and viewers', async () => {
    const resultEditor = getUserShareOptions({
      users: baseFileUsers,
      loggedInUser: FILE_USERS_BY_ROLE.EDITOR,
      user: FILE_USERS_BY_ROLE.EDITOR_ALT,
    });
    const resultViewer = getUserShareOptions({
      users: baseFileUsers,
      loggedInUser: FILE_USERS_BY_ROLE.EDITOR,
      user: FILE_USERS_BY_ROLE.VIEWER,
    });
    expect(resultEditor).toStrictEqual(['Can edit', 'Can view', 'Remove']);
    expect(resultEditor).toStrictEqual(resultViewer);
  });
});

describe('Share menu for a file VIEWER', () => {
  it('Has only one option for owners', async () => {
    const result = getUserShareOptions({
      users: baseFileUsers,
      loggedInUser: FILE_USERS_BY_ROLE.VIEWER,
      user: FILE_USERS_BY_ROLE.OWNER,
    });
    expect(result).toStrictEqual(['Owner']);
  });
  it('Has only one option for editors', async () => {
    const result = getUserShareOptions({
      users: baseFileUsers,
      loggedInUser: FILE_USERS_BY_ROLE.VIEWER,
      user: FILE_USERS_BY_ROLE.EDITOR,
    });
    expect(result).toStrictEqual(['Can edit']);
  });
  it('Has multiple options for themselves as a viewer', async () => {
    const result = getUserShareOptions({
      users: baseFileUsers,
      loggedInUser: FILE_USERS_BY_ROLE.VIEWER,
      user: FILE_USERS_BY_ROLE.VIEWER,
    });
    expect(result).toStrictEqual(['Can view', 'Leave']);
  });
  it('Has only one option for other viewers', async () => {
    const result = getUserShareOptions({
      users: baseFileUsers,
      loggedInUser: FILE_USERS_BY_ROLE.VIEWER,
      user: FILE_USERS_BY_ROLE.VIEWER_ALT,
    });
    expect(result).toStrictEqual(['Can view']);
  });
});
