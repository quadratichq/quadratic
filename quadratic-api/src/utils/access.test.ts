import { getFileAccess } from './access';

describe('getFileAccess', () => {
  // const tests = [
  //   [
  //     { roleFile: 'OWNER', roleTeam: 'OWNER', publicLinkAccess: 'NOT_SHARED' },
  //     ['FILE_VIEW', 'FILE_EDIT', 'FILE_DELETE'],
  //   ],
  //   [{ roleFile: 'OWNER', roleTeam: 'OWNER', publicLinkAccess: 'READONLY' }, ['FILE_VIEW', 'FILE_EDIT', 'FILE_DELETE']],
  //   [{ roleFile: 'OWNER', roleTeam: 'OWNER', publicLinkAccess: 'EDIT' }, ['FILE_VIEW', 'FILE_EDIT', 'FILE_DELETE']],
  // ];

  // tests.forEach(([input, expected]) => {
  //   it('should allow a file OWNER full access', () => {
  //     const res = getFileAccess(input);
  //     expected.forEach((v) => {
  //       it(`should allow ${v}`, () => {
  //         expect(res).toContain(v);
  //       });
  //     });
  //   });
  // });

  // FILE_DELETE is only avialable to specific people
  // FILE_EDIT is only available to specific people

  it('should allow a file OWNER full access', () => {
    const res = getFileAccess({ roleFile: 'OWNER', roleTeam: 'OWNER', publicLinkAccess: 'EDIT' });
    expect(res).toContain('FILE_VIEW');
    expect(res).toContain('FILE_EDIT');
    expect(res).toContain('FILE_DELETE');
  });
  it('should allow a team OWNER full access', () => {
    const res = getFileAccess({ roleFile: 'OWNER', roleTeam: 'OWNER', publicLinkAccess: 'EDIT' });
    expect(res).toContain('FILE_VIEW');
    expect(res).toContain('FILE_EDIT');
    expect(res).toContain('FILE_DELETE');
  });
});
