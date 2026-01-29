import type { Team } from '@prisma/client';
import dbClient from '../dbClient';
import { clearDb, createFile, createTeam, createUser, upgradeTeamToPro } from '../tests/testDataGenerator';
import { getEditableFileIds, getFileLimitInfo, getFreeEditableFileLimit, requiresUpgradeToEdit } from './billing';
import type { DecryptedTeam } from './teams';

// Mock FREE_EDITABLE_FILE_LIMIT for testing
jest.mock('../env-vars', () => ({
  ...jest.requireActual('../env-vars'),
  FREE_EDITABLE_FILE_LIMIT: 5,
}));

let userId: number;

beforeEach(async () => {
  userId = (
    await createUser({
      auth0Id: 'testUser',
    })
  ).id;
});

afterEach(clearDb);

describe('getFreeEditableFileLimit', () => {
  it('returns the configured limit', () => {
    expect(getFreeEditableFileLimit()).toBe(5);
  });
});

describe('getEditableFileIds', () => {
  it('returns all file IDs for paid teams', async () => {
    let team: DecryptedTeam | Team | null = await createTeam({
      team: { uuid: '00000000-0000-0000-0000-000000000001' },
      users: [{ userId, role: 'OWNER' }],
    });

    await upgradeTeamToPro(team.id);
    team = await dbClient.team.findUnique({ where: { id: team.id } });
    if (!team) throw new Error('Team not found');

    // Create 5 files (at the free limit of 5)
    const fileIds: number[] = [];
    for (let i = 0; i < 5; i++) {
      const file = await createFile({
        data: {
          uuid: `00000000-0000-0000-0001-00000000000${i}`,
          name: `File ${i}`,
          creatorUserId: userId,
          ownerTeamId: team.id,
        },
      });
      fileIds.push(file.id);
    }

    const editableIds = await getEditableFileIds(team);
    expect(editableIds).toHaveLength(5);
    expect(editableIds.sort()).toEqual(fileIds.sort());
  });

  it('returns only N most recent file IDs for free teams', async () => {
    const team = await createTeam({
      team: { uuid: '00000000-0000-0000-0000-000000000002' },
      users: [{ userId, role: 'OWNER' }],
    });

    // Create 7 files with staggered creation dates (more than limit of 5)
    const files = [];
    for (let i = 0; i < 7; i++) {
      const file = await createFile({
        data: {
          uuid: `00000000-0000-0000-0002-00000000000${i}`,
          name: `File ${i}`,
          creatorUserId: userId,
          ownerTeamId: team.id,
          createdDate: new Date(Date.now() + i * 1000), // Stagger creation times
        },
      });
      files.push(file);
    }

    const editableIds = await getEditableFileIds(team);
    expect(editableIds).toHaveLength(5);

    // Should contain the 5 most recent files (files 6, 5, 4, 3, 2)
    const expectedIds = [files[6].id, files[5].id, files[4].id, files[3].id, files[2].id];
    expect(editableIds.sort()).toEqual(expectedIds.sort());
  });

  it('excludes deleted files', async () => {
    const team = await createTeam({
      team: { uuid: '00000000-0000-0000-0000-000000000003' },
      users: [{ userId, role: 'OWNER' }],
    });

    // Create 4 files, delete 2
    const file1 = await createFile({
      data: {
        uuid: '00000000-0000-0000-0003-000000000001',
        name: 'File 1',
        creatorUserId: userId,
        ownerTeamId: team.id,
        createdDate: new Date(Date.now()),
      },
    });
    await createFile({
      data: {
        uuid: '00000000-0000-0000-0003-000000000002',
        name: 'Deleted File 1',
        creatorUserId: userId,
        ownerTeamId: team.id,
        deleted: true,
        deletedDate: new Date(),
        createdDate: new Date(Date.now() + 1000),
      },
    });
    const file3 = await createFile({
      data: {
        uuid: '00000000-0000-0000-0003-000000000003',
        name: 'File 3',
        creatorUserId: userId,
        ownerTeamId: team.id,
        createdDate: new Date(Date.now() + 2000),
      },
    });
    await createFile({
      data: {
        uuid: '00000000-0000-0000-0003-000000000004',
        name: 'Deleted File 2',
        creatorUserId: userId,
        ownerTeamId: team.id,
        deleted: true,
        deletedDate: new Date(),
        createdDate: new Date(Date.now() + 3000),
      },
    });

    const editableIds = await getEditableFileIds(team);
    expect(editableIds).toHaveLength(2);
    expect(editableIds.sort()).toEqual([file1.id, file3.id].sort());
  });
});

describe('requiresUpgradeToEdit', () => {
  it('returns false for all files on paid teams', async () => {
    let team: DecryptedTeam | Team | null = await createTeam({
      team: { uuid: '00000000-0000-0000-0000-000000000010' },
      users: [{ userId, role: 'OWNER' }],
    });

    await upgradeTeamToPro(team.id);
    team = await dbClient.team.findUnique({ where: { id: team.id } });
    if (!team) throw new Error('Team not found');

    // Create 5 files
    const files = [];
    for (let i = 0; i < 5; i++) {
      const file = await createFile({
        data: {
          uuid: `00000000-0000-0000-0010-00000000000${i}`,
          name: `File ${i}`,
          creatorUserId: userId,
          ownerTeamId: team.id,
        },
      });
      files.push(file);
    }

    // All files should be editable
    for (const file of files) {
      expect(await requiresUpgradeToEdit(team, file.id)).toBe(false);
    }
  });

  it('returns true for older files on free teams beyond the limit', async () => {
    const team = await createTeam({
      team: { uuid: '00000000-0000-0000-0000-000000000011' },
      users: [{ userId, role: 'OWNER' }],
    });

    // Create 7 files with staggered creation dates (more than limit of 5)
    const files = [];
    for (let i = 0; i < 7; i++) {
      const file = await createFile({
        data: {
          uuid: `00000000-0000-0000-0011-00000000000${i}`,
          name: `File ${i}`,
          creatorUserId: userId,
          ownerTeamId: team.id,
          createdDate: new Date(Date.now() + i * 1000),
        },
      });
      files.push(file);
    }

    // Oldest 2 files (files[0], files[1]) should be restricted
    expect(await requiresUpgradeToEdit(team, files[0].id)).toBe(true);
    expect(await requiresUpgradeToEdit(team, files[1].id)).toBe(true);

    // Newest 5 files (files[2], files[3], files[4], files[5], files[6]) should NOT be restricted
    expect(await requiresUpgradeToEdit(team, files[2].id)).toBe(false);
    expect(await requiresUpgradeToEdit(team, files[3].id)).toBe(false);
    expect(await requiresUpgradeToEdit(team, files[4].id)).toBe(false);
    expect(await requiresUpgradeToEdit(team, files[5].id)).toBe(false);
    expect(await requiresUpgradeToEdit(team, files[6].id)).toBe(false);
  });

  it('returns false for all files when under the limit', async () => {
    const team = await createTeam({
      team: { uuid: '00000000-0000-0000-0000-000000000012' },
      users: [{ userId, role: 'OWNER' }],
    });

    // Create only 4 files (under limit of 5)
    const files = [];
    for (let i = 0; i < 4; i++) {
      const file = await createFile({
        data: {
          uuid: `00000000-0000-0000-0012-00000000000${i}`,
          name: `File ${i}`,
          creatorUserId: userId,
          ownerTeamId: team.id,
        },
      });
      files.push(file);
    }

    // All files should be editable
    for (const file of files) {
      expect(await requiresUpgradeToEdit(team, file.id)).toBe(false);
    }
  });
});

describe('getFileLimitInfo', () => {
  it('returns correct info for free team under limit', async () => {
    const team = await createTeam({
      team: { uuid: '00000000-0000-0000-0000-000000000020' },
      users: [{ userId, role: 'OWNER' }],
    });

    // Create 4 files (under limit of 5)
    for (let i = 0; i < 4; i++) {
      await createFile({
        data: {
          uuid: `00000000-0000-0000-0020-00000000000${i}`,
          name: `File ${i}`,
          creatorUserId: userId,
          ownerTeamId: team.id,
        },
      });
    }

    const info = await getFileLimitInfo(team);
    expect(info.isOverLimit).toBe(false);
    expect(info.totalFiles).toBe(4);
    expect(info.maxEditableFiles).toBe(5);
    expect(info.editableFileIds).toHaveLength(4);
  });

  it('returns correct info for free team at limit', async () => {
    const team = await createTeam({
      team: { uuid: '00000000-0000-0000-0000-000000000021' },
      users: [{ userId, role: 'OWNER' }],
    });

    // Create exactly 5 files (at limit)
    for (let i = 0; i < 5; i++) {
      await createFile({
        data: {
          uuid: `00000000-0000-0000-0021-00000000000${i}`,
          name: `File ${i}`,
          creatorUserId: userId,
          ownerTeamId: team.id,
        },
      });
    }

    const info = await getFileLimitInfo(team);
    expect(info.isOverLimit).toBe(false); // At limit (not over) - all 5 files are editable
    expect(info.totalFiles).toBe(5);
    expect(info.maxEditableFiles).toBe(5);
    expect(info.editableFileIds).toHaveLength(5);
  });

  it('returns correct info for free team over limit', async () => {
    const team = await createTeam({
      team: { uuid: '00000000-0000-0000-0000-000000000022' },
      users: [{ userId, role: 'OWNER' }],
    });

    // Create 7 files (over limit of 5)
    for (let i = 0; i < 7; i++) {
      await createFile({
        data: {
          uuid: `00000000-0000-0000-0022-00000000000${i}`,
          name: `File ${i}`,
          creatorUserId: userId,
          ownerTeamId: team.id,
        },
      });
    }

    const info = await getFileLimitInfo(team);
    expect(info.isOverLimit).toBe(true);
    expect(info.totalFiles).toBe(7);
    expect(info.maxEditableFiles).toBe(5);
    expect(info.editableFileIds).toHaveLength(5); // Only 5 are editable
  });

  it('returns correct info for paid team (no limit)', async () => {
    let team: DecryptedTeam | Team | null = await createTeam({
      team: { uuid: '00000000-0000-0000-0000-000000000023' },
      users: [{ userId, role: 'OWNER' }],
    });

    await upgradeTeamToPro(team.id);
    team = await dbClient.team.findUnique({ where: { id: team.id } });
    if (!team) throw new Error('Team not found');

    // Create 10 files
    for (let i = 0; i < 10; i++) {
      await createFile({
        data: {
          uuid: `00000000-0000-0000-0023-0000000000${i.toString().padStart(2, '0')}`,
          name: `File ${i}`,
          creatorUserId: userId,
          ownerTeamId: team.id,
        },
      });
    }

    const info = await getFileLimitInfo(team);
    expect(info.isOverLimit).toBe(false);
    expect(info.totalFiles).toBe(10);
    expect(info.maxEditableFiles).toBe(Infinity);
    expect(info.editableFileIds).toHaveLength(10); // All files editable
  });

  it('does not count deleted files', async () => {
    const team = await createTeam({
      team: { uuid: '00000000-0000-0000-0000-000000000024' },
      users: [{ userId, role: 'OWNER' }],
    });

    // Create 7 files, delete 3
    for (let i = 0; i < 7; i++) {
      await createFile({
        data: {
          uuid: `00000000-0000-0000-0024-00000000000${i}`,
          name: `File ${i}`,
          creatorUserId: userId,
          ownerTeamId: team.id,
          deleted: i < 3, // First 3 are deleted
          deletedDate: i < 3 ? new Date() : null,
        },
      });
    }

    const info = await getFileLimitInfo(team);
    expect(info.totalFiles).toBe(4); // Only 4 non-deleted files
    expect(info.isOverLimit).toBe(false); // 4 < 5, so under limit
    expect(info.editableFileIds).toHaveLength(4);
  });
});
