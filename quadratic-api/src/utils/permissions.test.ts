import { getFilePermissions } from './permissions';

describe('getTeamPermissions', () => {
  it.todo('to come...');
});

describe('getFilePermissions', () => {
  // vemd: V = View, E = Edit, M = Move, D = Delete
  // prettier-ignore
  const tests: [Parameters<typeof getFilePermissions>[0], string][] = [
    [{ isLoggedIn: false, fileRole: undefined, publicLinkAccess: 'NOT_SHARED', isFileOwner: false, teamRole: undefined}, ''],    
    [{ isLoggedIn: false, fileRole: 'VIEWER',  publicLinkAccess: 'NOT_SHARED', isFileOwner: false, teamRole: undefined}, ''],
    [{ isLoggedIn: false, fileRole: 'EDITOR',  publicLinkAccess: 'NOT_SHARED', isFileOwner: false, teamRole: undefined}, ''],

    [{ isLoggedIn: false, fileRole: undefined, publicLinkAccess: 'READONLY',   isFileOwner: false, teamRole: undefined}, 'V'],
    [{ isLoggedIn: false, fileRole: 'VIEWER',  publicLinkAccess: 'READONLY',   isFileOwner: false, teamRole: undefined}, 'V'],
    [{ isLoggedIn: false, fileRole: 'EDITOR',  publicLinkAccess: 'READONLY',   isFileOwner: false, teamRole: undefined}, 'V'],

    [{ isLoggedIn: false, fileRole: undefined, publicLinkAccess: 'EDIT',       isFileOwner: false, teamRole: undefined}, 'V'],
    [{ isLoggedIn: false, fileRole: 'VIEWER',  publicLinkAccess: 'EDIT',       isFileOwner: false, teamRole: undefined}, 'V'],
    [{ isLoggedIn: false, fileRole: 'EDITOR',  publicLinkAccess: 'EDIT',       isFileOwner: false, teamRole: undefined}, 'V'],


    [{ isLoggedIn: false, fileRole: undefined, publicLinkAccess: 'NOT_SHARED', isFileOwner: true,  teamRole: undefined}, ''],
    [{ isLoggedIn: false, fileRole: 'VIEWER',  publicLinkAccess: 'NOT_SHARED', isFileOwner: true,  teamRole: undefined}, ''],
    [{ isLoggedIn: false, fileRole: 'EDITOR',  publicLinkAccess: 'NOT_SHARED', isFileOwner: true,  teamRole: undefined}, ''],

    [{ isLoggedIn: false, fileRole: undefined, publicLinkAccess: 'READONLY',   isFileOwner: true,  teamRole: undefined}, 'V'],
    [{ isLoggedIn: false, fileRole: 'VIEWER',  publicLinkAccess: 'READONLY',   isFileOwner: true,  teamRole: undefined}, 'V'],
    [{ isLoggedIn: false, fileRole: 'EDITOR',  publicLinkAccess: 'READONLY',   isFileOwner: true,  teamRole: undefined}, 'V'],

    [{ isLoggedIn: false, fileRole: undefined, publicLinkAccess: 'EDIT',       isFileOwner: true,  teamRole: undefined}, 'V'],
    [{ isLoggedIn: false, fileRole: 'VIEWER',  publicLinkAccess: 'EDIT',       isFileOwner: true,  teamRole: undefined}, 'V'],
    [{ isLoggedIn: false, fileRole: 'EDITOR',  publicLinkAccess: 'EDIT',       isFileOwner: true,  teamRole: undefined}, 'V'],



    [{ isLoggedIn: true,  fileRole: undefined, publicLinkAccess: 'NOT_SHARED', isFileOwner: false, teamRole: undefined}, ''],    
    [{ isLoggedIn: true,  fileRole: 'VIEWER',  publicLinkAccess: 'NOT_SHARED', isFileOwner: false, teamRole: undefined}, 'V'],
    [{ isLoggedIn: true,  fileRole: 'EDITOR',  publicLinkAccess: 'NOT_SHARED', isFileOwner: false, teamRole: undefined}, 'VE'],

    [{ isLoggedIn: true,  fileRole: undefined, publicLinkAccess: 'READONLY',   isFileOwner: false, teamRole: undefined}, 'V'],
    [{ isLoggedIn: true,  fileRole: 'VIEWER',  publicLinkAccess: 'READONLY',   isFileOwner: false, teamRole: undefined}, 'V'],
    [{ isLoggedIn: true,  fileRole: 'EDITOR',  publicLinkAccess: 'READONLY',   isFileOwner: false, teamRole: undefined}, 'VE'],

    [{ isLoggedIn: true,  fileRole: undefined, publicLinkAccess: 'EDIT',       isFileOwner: false, teamRole: undefined}, 'VE'],
    [{ isLoggedIn: true,  fileRole: 'VIEWER',  publicLinkAccess: 'EDIT',       isFileOwner: false, teamRole: undefined}, 'VE'],
    [{ isLoggedIn: true,  fileRole: 'EDITOR',  publicLinkAccess: 'EDIT',       isFileOwner: false, teamRole: undefined}, 'VE'],

    
    [{ isLoggedIn: true,  fileRole: undefined, publicLinkAccess: 'NOT_SHARED', isFileOwner: true,  teamRole: undefined}, 'VEMD'],
    [{ isLoggedIn: true,  fileRole: 'VIEWER',  publicLinkAccess: 'NOT_SHARED', isFileOwner: true,  teamRole: undefined}, 'VEMD'],
    [{ isLoggedIn: true,  fileRole: 'EDITOR',  publicLinkAccess: 'NOT_SHARED', isFileOwner: true,  teamRole: undefined}, 'VEMD'],

    [{ isLoggedIn: true,  fileRole: undefined, publicLinkAccess: 'READONLY',   isFileOwner: true,  teamRole: undefined}, 'VEMD'],
    [{ isLoggedIn: true,  fileRole: 'VIEWER',  publicLinkAccess: 'READONLY',   isFileOwner: true,  teamRole: undefined}, 'VEMD'],
    [{ isLoggedIn: true,  fileRole: 'EDITOR',  publicLinkAccess: 'READONLY',   isFileOwner: true,  teamRole: undefined}, 'VEMD'],

    [{ isLoggedIn: true,  fileRole: undefined, publicLinkAccess: 'EDIT',       isFileOwner: true,  teamRole: undefined}, 'VEMD'],
    [{ isLoggedIn: true,  fileRole: 'VIEWER',  publicLinkAccess: 'EDIT',       isFileOwner: true,  teamRole: undefined}, 'VEMD'],
    [{ isLoggedIn: true,  fileRole: 'EDITOR',  publicLinkAccess: 'EDIT',       isFileOwner: true,  teamRole: undefined}, 'VEMD'],
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
