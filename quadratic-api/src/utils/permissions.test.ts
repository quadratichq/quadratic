import { getFilePermissions } from './permissions';

describe('getTeamPermissions', () => {
  it.todo('to come...');
});

describe('getFilePermissions', () => {
  // ved: v = view, e = edit, d = delete
  // prettier-ignore
  const tests: [Parameters<typeof getFilePermissions>[0], ('ved' | 've-' | 'v--' | '---')][] = [
    [{ isLoggedIn: false, fileRole: undefined, publicLinkAccess: 'NOT_SHARED', isFileOwner: false, teamRole: undefined}, '---'],    
    [{ isLoggedIn: false, fileRole: 'VIEWER',  publicLinkAccess: 'NOT_SHARED', isFileOwner: false, teamRole: undefined}, '---'],
    [{ isLoggedIn: false, fileRole: 'EDITOR',  publicLinkAccess: 'NOT_SHARED', isFileOwner: false, teamRole: undefined}, '---'],

    [{ isLoggedIn: false, fileRole: undefined, publicLinkAccess: 'READONLY',   isFileOwner: false, teamRole: undefined}, 'v--'],
    [{ isLoggedIn: false, fileRole: 'VIEWER',  publicLinkAccess: 'READONLY',   isFileOwner: false, teamRole: undefined}, 'v--'],
    [{ isLoggedIn: false, fileRole: 'EDITOR',  publicLinkAccess: 'READONLY',   isFileOwner: false, teamRole: undefined}, 'v--'],

    [{ isLoggedIn: false, fileRole: undefined, publicLinkAccess: 'EDIT',       isFileOwner: false, teamRole: undefined}, 'v--'],
    [{ isLoggedIn: false, fileRole: 'VIEWER',  publicLinkAccess: 'EDIT',       isFileOwner: false, teamRole: undefined}, 'v--'],
    [{ isLoggedIn: false, fileRole: 'EDITOR',  publicLinkAccess: 'EDIT',       isFileOwner: false, teamRole: undefined}, 'v--'],


    [{ isLoggedIn: false, fileRole: undefined, publicLinkAccess: 'NOT_SHARED', isFileOwner: true,  teamRole: undefined}, '---'],
    [{ isLoggedIn: false, fileRole: 'VIEWER',  publicLinkAccess: 'NOT_SHARED', isFileOwner: true,  teamRole: undefined}, '---'],
    [{ isLoggedIn: false, fileRole: 'EDITOR',  publicLinkAccess: 'NOT_SHARED', isFileOwner: true,  teamRole: undefined}, '---'],

    [{ isLoggedIn: false, fileRole: undefined, publicLinkAccess: 'READONLY',   isFileOwner: true,  teamRole: undefined}, 'v--'],
    [{ isLoggedIn: false, fileRole: 'VIEWER',  publicLinkAccess: 'READONLY',   isFileOwner: true,  teamRole: undefined}, 'v--'],
    [{ isLoggedIn: false, fileRole: 'EDITOR',  publicLinkAccess: 'READONLY',   isFileOwner: true,  teamRole: undefined}, 'v--'],

    [{ isLoggedIn: false, fileRole: undefined, publicLinkAccess: 'EDIT',       isFileOwner: true,  teamRole: undefined}, 'v--'],
    [{ isLoggedIn: false, fileRole: 'VIEWER',  publicLinkAccess: 'EDIT',       isFileOwner: true,  teamRole: undefined}, 'v--'],
    [{ isLoggedIn: false, fileRole: 'EDITOR',  publicLinkAccess: 'EDIT',       isFileOwner: true,  teamRole: undefined}, 'v--'],



    [{ isLoggedIn: true,  fileRole: undefined, publicLinkAccess: 'NOT_SHARED', isFileOwner: false, teamRole: undefined}, '---'],    
    [{ isLoggedIn: true,  fileRole: 'VIEWER',  publicLinkAccess: 'NOT_SHARED', isFileOwner: false, teamRole: undefined}, 'v--'],
    [{ isLoggedIn: true,  fileRole: 'EDITOR',  publicLinkAccess: 'NOT_SHARED', isFileOwner: false, teamRole: undefined}, 've-'],

    [{ isLoggedIn: true,  fileRole: undefined, publicLinkAccess: 'READONLY',   isFileOwner: false, teamRole: undefined}, 'v--'],
    [{ isLoggedIn: true,  fileRole: 'VIEWER',  publicLinkAccess: 'READONLY',   isFileOwner: false, teamRole: undefined}, 'v--'],
    [{ isLoggedIn: true,  fileRole: 'EDITOR',  publicLinkAccess: 'READONLY',   isFileOwner: false, teamRole: undefined}, 've-'],

    [{ isLoggedIn: true,  fileRole: undefined, publicLinkAccess: 'EDIT',       isFileOwner: false, teamRole: undefined}, 've-'],
    [{ isLoggedIn: true,  fileRole: 'VIEWER',  publicLinkAccess: 'EDIT',       isFileOwner: false, teamRole: undefined}, 've-'],
    [{ isLoggedIn: true,  fileRole: 'EDITOR',  publicLinkAccess: 'EDIT',       isFileOwner: false, teamRole: undefined}, 've-'],

    
    [{ isLoggedIn: true,  fileRole: undefined, publicLinkAccess: 'NOT_SHARED', isFileOwner: true,  teamRole: undefined}, 'ved'],
    [{ isLoggedIn: true,  fileRole: 'VIEWER',  publicLinkAccess: 'NOT_SHARED', isFileOwner: true,  teamRole: undefined}, 'ved'],
    [{ isLoggedIn: true,  fileRole: 'EDITOR',  publicLinkAccess: 'NOT_SHARED', isFileOwner: true,  teamRole: undefined}, 'ved'],

    [{ isLoggedIn: true,  fileRole: undefined, publicLinkAccess: 'READONLY',   isFileOwner: true,  teamRole: undefined}, 'ved'],
    [{ isLoggedIn: true,  fileRole: 'VIEWER',  publicLinkAccess: 'READONLY',   isFileOwner: true,  teamRole: undefined}, 'ved'],
    [{ isLoggedIn: true,  fileRole: 'EDITOR',  publicLinkAccess: 'READONLY',   isFileOwner: true,  teamRole: undefined}, 'ved'],

    [{ isLoggedIn: true,  fileRole: undefined, publicLinkAccess: 'EDIT',       isFileOwner: true,  teamRole: undefined}, 'ved'],
    [{ isLoggedIn: true,  fileRole: 'VIEWER',  publicLinkAccess: 'EDIT',       isFileOwner: true,  teamRole: undefined}, 'ved'],
    [{ isLoggedIn: true,  fileRole: 'EDITOR',  publicLinkAccess: 'EDIT',       isFileOwner: true,  teamRole: undefined}, 'ved'],
  ];

  tests.forEach(([input, access]) => {
    it(`should allow "${access}" access for ${JSON.stringify(input)}`, () => {
      const res = getFilePermissions(input);
      if (access === 'ved') {
        expect(res).toContain('FILE_VIEW');
        expect(res).toContain('FILE_EDIT');
        expect(res).toContain('FILE_DELETE');
      } else if (access === 've-') {
        expect(res).toContain('FILE_VIEW');
        expect(res).toContain('FILE_EDIT');
        expect(res).not.toContain('FILE_DELETE');
      } else if (access === 'v--') {
        expect(res).toContain('FILE_VIEW');
        expect(res).not.toContain('FILE_EDIT');
        expect(res).not.toContain('FILE_DELETE');
      } else if (access === '---') {
        expect(res.length).toBe(0);
      } else {
        throw new Error(`Invalid access type: ${access}`);
      }
    });
  });
});
