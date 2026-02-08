import { firstRoleIsHigherThanSecond, getFilePermissions, getTeamPermissions } from './permissions';

describe('firstRoleIsHigherThanSecond', () => {
  // prettier-ignore
  const tests: [
    Parameters<typeof firstRoleIsHigherThanSecond>[0],
    Parameters<typeof firstRoleIsHigherThanSecond>[1],
    boolean
  ][] = [
    [undefined, undefined, false],
    ['OWNER',   undefined, true],
    ['EDITOR',  undefined, true],
    ['VIEWER',  undefined, true],
    ['OWNER',   'OWNER',   false],
    ['EDITOR',  'OWNER',   false],
    ['VIEWER',  'OWNER',   false],
    ['OWNER',   'EDITOR',  true],
    ['EDITOR',  'EDITOR',  false],
    ['VIEWER',  'EDITOR',  false],
    ['OWNER',   'VIEWER',  true],
    ['EDITOR',  'VIEWER',  true],
    ['VIEWER',  'VIEWER',  false],
  ];
  tests.forEach(([first, second, expected]) => {
    it(`should return ${expected} for: ${first} > ${second}`, () => {
      expect(firstRoleIsHigherThanSecond(first, second)).toBe(expected);
    });
  });
});

describe('getTeamPermissions', () => {
  it('returns corrent permissions for an OWNER', async () => {
    const result = getTeamPermissions('OWNER');
    expect(result).toContain('TEAM_VIEW');
    expect(result).toContain('TEAM_EDIT');
    expect(result).toContain('TEAM_MANAGE');
  });
  it('returns corrent permissions for an EDITOR', async () => {
    const result = getTeamPermissions('EDITOR');
    expect(result).toContain('TEAM_VIEW');
    expect(result).toContain('TEAM_EDIT');
    expect(result).not.toContain('TEAM_MANAGE');
  });
  it('returns corrent permissions for a VIEWER', async () => {
    const result = getTeamPermissions('VIEWER');
    expect(result).toContain('TEAM_VIEW');
    expect(result).not.toContain('TEAM_EDIT');
    expect(result).not.toContain('TEAM_MANAGE');
  });
  it('returns no permissions for an invalid input', async () => {
    const result = getTeamPermissions('' as any);
    expect(result).toEqual([]);
  });
});

describe('getFilePermissions', () => {
  // vemd: V = View, E = Edit, M = Move, D = Delete
  // prettier-ignore
  const tests: [Parameters<typeof getFilePermissions>[0], string][] = [
    
    // Logged out user
    // ---------------
    [{ publicLinkAccess: 'NOT_SHARED',  userFileRelationship: undefined }, ''],
    [{ publicLinkAccess: 'READONLY',    userFileRelationship: undefined }, 'V'],
    [{ publicLinkAccess: 'EDIT',        userFileRelationship: undefined }, 'V'],

    // Logged in user
    // --------------

    // File in a team, but it's private to the current user
    // TODO this will require the team to know whether you can move it or not
    [{ publicLinkAccess: 'NOT_SHARED',  userFileRelationship: { context: 'private-to-me', teamRole: 'OWNER' } }, 'VEMD'],
    [{ publicLinkAccess: 'READONLY',    userFileRelationship: { context: 'private-to-me', teamRole: 'OWNER' } }, 'VEMD'],
    [{ publicLinkAccess: 'EDIT',        userFileRelationship: { context: 'private-to-me', teamRole: 'OWNER' } }, 'VEMD'],
    [{ publicLinkAccess: 'NOT_SHARED',  userFileRelationship: { context: 'private-to-me', teamRole: 'EDITOR' } }, 'VEMD'],
    [{ publicLinkAccess: 'READONLY',    userFileRelationship: { context: 'private-to-me', teamRole: 'EDITOR' } }, 'VEMD'],
    [{ publicLinkAccess: 'EDIT',        userFileRelationship: { context: 'private-to-me', teamRole: 'EDITOR' } }, 'VEMD'],
    [{ publicLinkAccess: 'NOT_SHARED',  userFileRelationship: { context: 'private-to-me', teamRole: 'VIEWER' } }, 'VED'],
    [{ publicLinkAccess: 'READONLY',    userFileRelationship: { context: 'private-to-me', teamRole: 'VIEWER' } }, 'VED'],
    [{ publicLinkAccess: 'EDIT',        userFileRelationship: { context: 'private-to-me', teamRole: 'VIEWER' } }, 'VED'],
    // This should never happen, but if it does, we should default to the lowest access
    [{ publicLinkAccess: 'NOT_SHARED',  userFileRelationship: { context: 'private-to-me', teamRole: undefined } }, ''],
    [{ publicLinkAccess: 'READONLY',    userFileRelationship: { context: 'private-to-me', teamRole: undefined } }, 'V'],
    [{ publicLinkAccess: 'EDIT',        userFileRelationship: { context: 'private-to-me', teamRole: undefined } }, 'VE'],
    

    // File in a team, but it's private to someone other than the current user
    [{ publicLinkAccess: 'NOT_SHARED',  userFileRelationship: { context: 'private-to-someone-else', fileRole: undefined } }, ''],
    [{ publicLinkAccess: 'READONLY',    userFileRelationship: { context: 'private-to-someone-else', fileRole: undefined } }, 'V'],
    [{ publicLinkAccess: 'EDIT',        userFileRelationship: { context: 'private-to-someone-else', fileRole: undefined } }, 'VE'],
    [{ publicLinkAccess: 'NOT_SHARED',  userFileRelationship: { context: 'private-to-someone-else', fileRole: 'VIEWER'  } }, 'V'],
    [{ publicLinkAccess: 'READONLY',    userFileRelationship: { context: 'private-to-someone-else', fileRole: 'VIEWER'  } }, 'V'],
    [{ publicLinkAccess: 'EDIT',        userFileRelationship: { context: 'private-to-someone-else', fileRole: 'VIEWER'  } }, 'VE'],
    [{ publicLinkAccess: 'NOT_SHARED',  userFileRelationship: { context: 'private-to-someone-else', fileRole: 'EDITOR'  } }, 'VEM'],
    [{ publicLinkAccess: 'READONLY',    userFileRelationship: { context: 'private-to-someone-else', fileRole: 'EDITOR'  } }, 'VEM'],
    [{ publicLinkAccess: 'EDIT',        userFileRelationship: { context: 'private-to-someone-else', fileRole: 'EDITOR'  } }, 'VEM'],

    // File in a team without an 'owner' so it's public to everyone on the team
    [{ publicLinkAccess: 'NOT_SHARED',  userFileRelationship: { context: 'public-to-team', fileRole: undefined, teamRole: 'OWNER' } }, 'VEMD'],
    [{ publicLinkAccess: 'READONLY',    userFileRelationship: { context: 'public-to-team', fileRole: undefined, teamRole: 'OWNER' } }, 'VEMD'],
    [{ publicLinkAccess: 'EDIT',        userFileRelationship: { context: 'public-to-team', fileRole: undefined, teamRole: 'OWNER' } }, 'VEMD'],
    [{ publicLinkAccess: 'NOT_SHARED',  userFileRelationship: { context: 'public-to-team', fileRole: 'EDITOR',  teamRole: 'OWNER' } }, 'VEMD'],
    [{ publicLinkAccess: 'READONLY',    userFileRelationship: { context: 'public-to-team', fileRole: 'EDITOR',  teamRole: 'OWNER' } }, 'VEMD'],
    [{ publicLinkAccess: 'EDIT',        userFileRelationship: { context: 'public-to-team', fileRole: 'EDITOR',  teamRole: 'OWNER' } }, 'VEMD'],
    [{ publicLinkAccess: 'NOT_SHARED',  userFileRelationship: { context: 'public-to-team', fileRole: 'VIEWER',  teamRole: 'OWNER' } }, 'VEMD'],
    [{ publicLinkAccess: 'READONLY',    userFileRelationship: { context: 'public-to-team', fileRole: 'VIEWER',  teamRole: 'OWNER' } }, 'VEMD'],
    [{ publicLinkAccess: 'EDIT',        userFileRelationship: { context: 'public-to-team', fileRole: 'VIEWER',  teamRole: 'OWNER' } }, 'VEMD'],

    [{ publicLinkAccess: 'NOT_SHARED',  userFileRelationship: { context: 'public-to-team', fileRole: undefined, teamRole: 'EDITOR' } }, 'VEMD'],
    [{ publicLinkAccess: 'READONLY',    userFileRelationship: { context: 'public-to-team', fileRole: undefined, teamRole: 'EDITOR' } }, 'VEMD'],
    [{ publicLinkAccess: 'EDIT',        userFileRelationship: { context: 'public-to-team', fileRole: undefined, teamRole: 'EDITOR' } }, 'VEMD'],
    [{ publicLinkAccess: 'NOT_SHARED',  userFileRelationship: { context: 'public-to-team', fileRole: 'EDITOR',  teamRole: 'EDITOR' } }, 'VEMD'],
    [{ publicLinkAccess: 'READONLY',    userFileRelationship: { context: 'public-to-team', fileRole: 'EDITOR',  teamRole: 'EDITOR' } }, 'VEMD'],
    [{ publicLinkAccess: 'EDIT',        userFileRelationship: { context: 'public-to-team', fileRole: 'EDITOR',  teamRole: 'EDITOR' } }, 'VEMD'],
    [{ publicLinkAccess: 'NOT_SHARED',  userFileRelationship: { context: 'public-to-team', fileRole: 'VIEWER',  teamRole: 'EDITOR' } }, 'VEMD'],
    [{ publicLinkAccess: 'READONLY',    userFileRelationship: { context: 'public-to-team', fileRole: 'VIEWER',  teamRole: 'EDITOR' } }, 'VEMD'],
    [{ publicLinkAccess: 'EDIT',        userFileRelationship: { context: 'public-to-team', fileRole: 'VIEWER',  teamRole: 'EDITOR' } }, 'VEMD'],

    [{ publicLinkAccess: 'NOT_SHARED',  userFileRelationship: { context: 'public-to-team', fileRole: undefined, teamRole: 'VIEWER' } }, 'V'],
    [{ publicLinkAccess: 'READONLY',    userFileRelationship: { context: 'public-to-team', fileRole: undefined, teamRole: 'VIEWER' } }, 'V'],
    [{ publicLinkAccess: 'EDIT',        userFileRelationship: { context: 'public-to-team', fileRole: undefined, teamRole: 'VIEWER' } }, 'VE'],
    [{ publicLinkAccess: 'NOT_SHARED',  userFileRelationship: { context: 'public-to-team', fileRole: 'EDITOR',  teamRole: 'VIEWER' } }, 'VE'],
    [{ publicLinkAccess: 'READONLY',    userFileRelationship: { context: 'public-to-team', fileRole: 'EDITOR',  teamRole: 'VIEWER' } }, 'VE'],
    [{ publicLinkAccess: 'EDIT',        userFileRelationship: { context: 'public-to-team', fileRole: 'EDITOR',  teamRole: 'VIEWER' } }, 'VE'],
    [{ publicLinkAccess: 'NOT_SHARED',  userFileRelationship: { context: 'public-to-team', fileRole: 'VIEWER',  teamRole: 'VIEWER' } }, 'V'],
    [{ publicLinkAccess: 'READONLY',    userFileRelationship: { context: 'public-to-team', fileRole: 'VIEWER',  teamRole: 'VIEWER' } }, 'V'],
    [{ publicLinkAccess: 'EDIT',        userFileRelationship: { context: 'public-to-team', fileRole: 'VIEWER',  teamRole: 'VIEWER' } }, 'VE'],

    [{ publicLinkAccess: 'NOT_SHARED',  userFileRelationship: { context: 'public-to-team', fileRole: undefined, teamRole: undefined } }, ''],
    [{ publicLinkAccess: 'READONLY',    userFileRelationship: { context: 'public-to-team', fileRole: undefined, teamRole: undefined } }, 'V'],
    [{ publicLinkAccess: 'EDIT',        userFileRelationship: { context: 'public-to-team', fileRole: undefined, teamRole: undefined } }, 'VE'],
    [{ publicLinkAccess: 'NOT_SHARED',  userFileRelationship: { context: 'public-to-team', fileRole: 'EDITOR',  teamRole: undefined } }, 'VE'],
    [{ publicLinkAccess: 'READONLY',    userFileRelationship: { context: 'public-to-team', fileRole: 'EDITOR',  teamRole: undefined } }, 'VE'],
    [{ publicLinkAccess: 'EDIT',        userFileRelationship: { context: 'public-to-team', fileRole: 'EDITOR',  teamRole: undefined } }, 'VE'],
    [{ publicLinkAccess: 'NOT_SHARED',  userFileRelationship: { context: 'public-to-team', fileRole: 'VIEWER',  teamRole: undefined } }, 'V'],
    [{ publicLinkAccess: 'READONLY',    userFileRelationship: { context: 'public-to-team', fileRole: 'VIEWER',  teamRole: undefined } }, 'V'],
    [{ publicLinkAccess: 'EDIT',        userFileRelationship: { context: 'public-to-team', fileRole: 'VIEWER',  teamRole: undefined } }, 'VE'],
  ];

  tests.forEach(([input, access]) => {
    it(`should allow "${access}" access for ${JSON.stringify(input)}`, () => {
      const res = getFilePermissions(input);
      if (access.includes('V')) {
        expect(res).toContain('FILE_VIEW');
      } else {
        expect(res).not.toContain('FILE_VIEW');
      }
      if (access.includes('E')) {
        expect(res).toContain('FILE_EDIT');
      } else {
        expect(res).not.toContain('FILE_EDIT');
      }
      if (access.includes('M')) {
        expect(res).toContain('FILE_MOVE');
      } else {
        expect(res).not.toContain('FILE_MOVE');
      }
      if (access.includes('D')) {
        expect(res).toContain('FILE_DELETE');
      } else {
        expect(res).not.toContain('FILE_DELETE');
      }
      if (access.length === 0) {
        expect(res.length).toBe(0);
      }
    });
  });
});
