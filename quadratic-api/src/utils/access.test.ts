import { getFileAccess } from './access';

describe('getFileAccess', () => {
  const tests = [
    // File owners

    [{ roleFile: 'OWNER', roleTeam: 'OWNER', publicLinkAccess: 'EDIT' }, 'full'],
    [{ roleFile: 'OWNER', roleTeam: 'OWNER', publicLinkAccess: 'READONLY' }, 'full'],
    [{ roleFile: 'OWNER', roleTeam: 'OWNER', publicLinkAccess: 'NOT_SHARED' }, 'full'],

    [{ roleFile: 'OWNER', roleTeam: 'EDITOR', publicLinkAccess: 'EDIT' }, 'full'],
    [{ roleFile: 'OWNER', roleTeam: 'EDITOR', publicLinkAccess: 'READONLY' }, 'full'],
    [{ roleFile: 'OWNER', roleTeam: 'EDITOR', publicLinkAccess: 'NOT_SHARED' }, 'full'],

    [{ roleFile: 'OWNER', roleTeam: 'VIEWER', publicLinkAccess: 'EDIT' }, 'full'],
    [{ roleFile: 'OWNER', roleTeam: 'VIEWER', publicLinkAccess: 'READONLY' }, 'full'],
    [{ roleFile: 'OWNER', roleTeam: 'VIEWER', publicLinkAccess: 'NOT_SHARED' }, 'full'],

    [{ roleFile: 'OWNER', roleTeam: undefined, publicLinkAccess: 'EDIT' }, 'full'],
    [{ roleFile: 'OWNER', roleTeam: undefined, publicLinkAccess: 'READONLY' }, 'full'],
    [{ roleFile: 'OWNER', roleTeam: undefined, publicLinkAccess: 'NOT_SHARED' }, 'full'],

    // File editors

    [{ roleFile: 'EDITOR', roleTeam: 'OWNER', publicLinkAccess: 'EDIT' }, 'full'],
    [{ roleFile: 'EDITOR', roleTeam: 'OWNER', publicLinkAccess: 'READONLY' }, 'full'],
    [{ roleFile: 'EDITOR', roleTeam: 'OWNER', publicLinkAccess: 'NOT_SHARED' }, 'full'],

    [{ roleFile: 'EDITOR', roleTeam: 'EDITOR', publicLinkAccess: 'EDIT' }, 'full'],
    [{ roleFile: 'EDITOR', roleTeam: 'EDITOR', publicLinkAccess: 'READONLY' }, 'full'],
    [{ roleFile: 'EDITOR', roleTeam: 'EDITOR', publicLinkAccess: 'NOT_SHARED' }, 'full'],

    [{ roleFile: 'EDITOR', roleTeam: 'VIEWER', publicLinkAccess: 'EDIT' }, 'partial'],
    [{ roleFile: 'EDITOR', roleTeam: 'VIEWER', publicLinkAccess: 'READONLY' }, 'partial'],
    [{ roleFile: 'EDITOR', roleTeam: 'VIEWER', publicLinkAccess: 'NOT_SHARED' }, 'partial'],

    [{ roleFile: 'EDITOR', roleTeam: undefined, publicLinkAccess: 'EDIT' }, 'partial'],
    [{ roleFile: 'EDITOR', roleTeam: undefined, publicLinkAccess: 'READONLY' }, 'partial'],
    [{ roleFile: 'EDITOR', roleTeam: undefined, publicLinkAccess: 'NOT_SHARED' }, 'partial'],

    // File viewers

    [{ roleFile: 'VIEWER', roleTeam: 'OWNER', publicLinkAccess: 'EDIT' }, 'full'],
    [{ roleFile: 'VIEWER', roleTeam: 'OWNER', publicLinkAccess: 'READONLY' }, 'full'],
    [{ roleFile: 'VIEWER', roleTeam: 'OWNER', publicLinkAccess: 'NOT_SHARED' }, 'full'],

    [{ roleFile: 'VIEWER', roleTeam: 'EDITOR', publicLinkAccess: 'EDIT' }, 'full'],
    [{ roleFile: 'VIEWER', roleTeam: 'EDITOR', publicLinkAccess: 'READONLY' }, 'full'],
    [{ roleFile: 'VIEWER', roleTeam: 'EDITOR', publicLinkAccess: 'NOT_SHARED' }, 'full'],

    [{ roleFile: 'VIEWER', roleTeam: 'VIEWER', publicLinkAccess: 'EDIT' }, 'partial'],
    [{ roleFile: 'VIEWER', roleTeam: 'VIEWER', publicLinkAccess: 'READONLY' }, 'limited'],
    [{ roleFile: 'VIEWER', roleTeam: 'VIEWER', publicLinkAccess: 'NOT_SHARED' }, 'limited'],

    [{ roleFile: 'VIEWER', roleTeam: undefined, publicLinkAccess: 'EDIT' }, 'partial'],
    [{ roleFile: 'VIEWER', roleTeam: undefined, publicLinkAccess: 'READONLY' }, 'limited'],
    [{ roleFile: 'VIEWER', roleTeam: undefined, publicLinkAccess: 'NOT_SHARED' }, 'limited'],

    // No file role

    [{ roleFile: undefined, roleTeam: 'OWNER', publicLinkAccess: 'EDIT' }, 'full'],
    [{ roleFile: undefined, roleTeam: 'OWNER', publicLinkAccess: 'READONLY' }, 'full'],
    [{ roleFile: undefined, roleTeam: 'OWNER', publicLinkAccess: 'NOT_SHARED' }, 'full'],

    [{ roleFile: undefined, roleTeam: 'EDITOR', publicLinkAccess: 'EDIT' }, 'full'],
    [{ roleFile: undefined, roleTeam: 'EDITOR', publicLinkAccess: 'READONLY' }, 'full'],
    [{ roleFile: undefined, roleTeam: 'EDITOR', publicLinkAccess: 'NOT_SHARED' }, 'full'],

    [{ roleFile: undefined, roleTeam: 'VIEWER', publicLinkAccess: 'EDIT' }, 'partial'],
    [{ roleFile: undefined, roleTeam: 'VIEWER', publicLinkAccess: 'READONLY' }, 'limited'],
    [{ roleFile: undefined, roleTeam: 'VIEWER', publicLinkAccess: 'NOT_SHARED' }, 'limited'],

    [{ roleFile: undefined, roleTeam: undefined, publicLinkAccess: 'EDIT' }, 'partial'],
    [{ roleFile: undefined, roleTeam: undefined, publicLinkAccess: 'READONLY' }, 'limited'],
    // This shouldn't be possible
    // [{ roleFile: undefined, roleTeam: undefined, publicLinkAccess: 'NOT_SHARED' }, ''],
  ];

  tests.forEach(([input, access]: any) => {
    it(`should allow "${access}" access for ${JSON.stringify(input)}`, () => {
      const res = getFileAccess(input);
      if (access === 'full') {
        expect(res).toContain('FILE_VIEW');
        expect(res).toContain('FILE_EDIT');
        expect(res).toContain('FILE_DELETE');
      } else if (access === 'partial') {
        expect(res).toContain('FILE_VIEW');
        expect(res).toContain('FILE_EDIT');
        expect(res).not.toContain('FILE_DELETE');
      } else if (access === 'limited') {
        expect(res).toContain('FILE_VIEW');
        expect(res).not.toContain('FILE_EDIT');
        expect(res).not.toContain('FILE_DELETE');
      }
    });
  });
});
