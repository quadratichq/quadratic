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
    expect(result).toContain('TEAM_DELETE');
    expect(result).toContain('TEAM_BILLING_EDIT');
  });
  it('returns corrent permissions for an EDITOR', async () => {
    const result = getTeamPermissions('EDITOR');
    expect(result).toContain('TEAM_VIEW');
    expect(result).toContain('TEAM_EDIT');
    expect(result).not.toContain('TEAM_DELETE');
    expect(result).not.toContain('TEAM_BILLING_EDIT');
  });
  it('returns corrent permissions for a VIEWER', async () => {
    const result = getTeamPermissions('VIEWER');
    expect(result).toContain('TEAM_VIEW');
    expect(result).not.toContain('TEAM_EDIT');
    expect(result).not.toContain('TEAM_DELETE');
    expect(result).not.toContain('TEAM_BILLING_EDIT');
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

    // File owned by user making the request
    [{ publicLinkAccess: 'NOT_SHARED',  userFileRelationship: { owner: 'me' } }, 'VEMD'],
    [{ publicLinkAccess: 'READONLY',    userFileRelationship: { owner: 'me' } }, 'VEMD'],
    [{ publicLinkAccess: 'EDIT',        userFileRelationship: { owner: 'me' } }, 'VEMD'],

    // File owned by another user
    [{ publicLinkAccess: 'NOT_SHARED',  userFileRelationship: { owner: 'another-user', fileRole: undefined } }, ''],
    [{ publicLinkAccess: 'READONLY',    userFileRelationship: { owner: 'another-user', fileRole: undefined } }, 'V'],
    [{ publicLinkAccess: 'EDIT',        userFileRelationship: { owner: 'another-user', fileRole: undefined } }, 'VE'],
    [{ publicLinkAccess: 'NOT_SHARED',  userFileRelationship: { owner: 'another-user', fileRole: 'VIEWER'  } }, 'V'],
    [{ publicLinkAccess: 'READONLY',    userFileRelationship: { owner: 'another-user', fileRole: 'VIEWER'  } }, 'V'],
    [{ publicLinkAccess: 'EDIT',        userFileRelationship: { owner: 'another-user', fileRole: 'VIEWER'  } }, 'VE'],
    [{ publicLinkAccess: 'NOT_SHARED',  userFileRelationship: { owner: 'another-user', fileRole: 'EDITOR'  } }, 'VE'],
    [{ publicLinkAccess: 'READONLY',    userFileRelationship: { owner: 'another-user', fileRole: 'EDITOR'  } }, 'VE'],
    [{ publicLinkAccess: 'EDIT',        userFileRelationship: { owner: 'another-user', fileRole: 'EDITOR'  } }, 'VE'],

    // File owned by a team
    [{ publicLinkAccess: 'NOT_SHARED',  userFileRelationship: { owner: 'team', fileRole: undefined, teamRole: 'OWNER' } }, 'VEMD'],
    [{ publicLinkAccess: 'READONLY',    userFileRelationship: { owner: 'team', fileRole: undefined, teamRole: 'OWNER' } }, 'VEMD'],
    [{ publicLinkAccess: 'EDIT',        userFileRelationship: { owner: 'team', fileRole: undefined, teamRole: 'OWNER' } }, 'VEMD'],
    [{ publicLinkAccess: 'NOT_SHARED',  userFileRelationship: { owner: 'team', fileRole: 'EDITOR',  teamRole: 'OWNER' } }, 'VEMD'],
    [{ publicLinkAccess: 'READONLY',    userFileRelationship: { owner: 'team', fileRole: 'EDITOR',  teamRole: 'OWNER' } }, 'VEMD'],
    [{ publicLinkAccess: 'EDIT',        userFileRelationship: { owner: 'team', fileRole: 'EDITOR',  teamRole: 'OWNER' } }, 'VEMD'],
    [{ publicLinkAccess: 'NOT_SHARED',  userFileRelationship: { owner: 'team', fileRole: 'VIEWER',  teamRole: 'OWNER' } }, 'VEMD'],
    [{ publicLinkAccess: 'READONLY',    userFileRelationship: { owner: 'team', fileRole: 'VIEWER',  teamRole: 'OWNER' } }, 'VEMD'],
    [{ publicLinkAccess: 'EDIT',        userFileRelationship: { owner: 'team', fileRole: 'VIEWER',  teamRole: 'OWNER' } }, 'VEMD'],

    [{ publicLinkAccess: 'NOT_SHARED',  userFileRelationship: { owner: 'team', fileRole: undefined, teamRole: 'EDITOR' } }, 'VEMD'],
    [{ publicLinkAccess: 'READONLY',    userFileRelationship: { owner: 'team', fileRole: undefined, teamRole: 'EDITOR' } }, 'VEMD'],
    [{ publicLinkAccess: 'EDIT',        userFileRelationship: { owner: 'team', fileRole: undefined, teamRole: 'EDITOR' } }, 'VEMD'],
    [{ publicLinkAccess: 'NOT_SHARED',  userFileRelationship: { owner: 'team', fileRole: 'EDITOR',  teamRole: 'EDITOR' } }, 'VEMD'],
    [{ publicLinkAccess: 'READONLY',    userFileRelationship: { owner: 'team', fileRole: 'EDITOR',  teamRole: 'EDITOR' } }, 'VEMD'],
    [{ publicLinkAccess: 'EDIT',        userFileRelationship: { owner: 'team', fileRole: 'EDITOR',  teamRole: 'EDITOR' } }, 'VEMD'],
    [{ publicLinkAccess: 'NOT_SHARED',  userFileRelationship: { owner: 'team', fileRole: 'VIEWER',  teamRole: 'EDITOR' } }, 'VEMD'],
    [{ publicLinkAccess: 'READONLY',    userFileRelationship: { owner: 'team', fileRole: 'VIEWER',  teamRole: 'EDITOR' } }, 'VEMD'],
    [{ publicLinkAccess: 'EDIT',        userFileRelationship: { owner: 'team', fileRole: 'VIEWER',  teamRole: 'EDITOR' } }, 'VEMD'],

    [{ publicLinkAccess: 'NOT_SHARED',  userFileRelationship: { owner: 'team', fileRole: undefined, teamRole: 'VIEWER' } }, 'V'],
    [{ publicLinkAccess: 'READONLY',    userFileRelationship: { owner: 'team', fileRole: undefined, teamRole: 'VIEWER' } }, 'V'],
    [{ publicLinkAccess: 'EDIT',        userFileRelationship: { owner: 'team', fileRole: undefined, teamRole: 'VIEWER' } }, 'VE'],
    [{ publicLinkAccess: 'NOT_SHARED',  userFileRelationship: { owner: 'team', fileRole: 'EDITOR',  teamRole: 'VIEWER' } }, 'VE'],
    [{ publicLinkAccess: 'READONLY',    userFileRelationship: { owner: 'team', fileRole: 'EDITOR',  teamRole: 'VIEWER' } }, 'VE'],
    [{ publicLinkAccess: 'EDIT',        userFileRelationship: { owner: 'team', fileRole: 'EDITOR',  teamRole: 'VIEWER' } }, 'VE'],
    [{ publicLinkAccess: 'NOT_SHARED',  userFileRelationship: { owner: 'team', fileRole: 'VIEWER',  teamRole: 'VIEWER' } }, 'V'],
    [{ publicLinkAccess: 'READONLY',    userFileRelationship: { owner: 'team', fileRole: 'VIEWER',  teamRole: 'VIEWER' } }, 'V'],
    [{ publicLinkAccess: 'EDIT',        userFileRelationship: { owner: 'team', fileRole: 'VIEWER',  teamRole: 'VIEWER' } }, 'VE'],
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
