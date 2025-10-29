import type { Team } from '@prisma/client';
import dbClient from '../dbClient';
import { clearDb, createFile, createTeam, createUser, upgradeTeamToPro } from '../tests/testDataGenerator';
import { fileCountForTeam, hasReachedFileLimit } from './billing';
import type { DecryptedTeam } from './teams';

let userId: number;

beforeEach(async () => {
  // Create a user
  userId = (
    await createUser({
      auth0Id: 'testUser',
    })
  ).id;
});

afterEach(clearDb);

describe('fileCountForTeam', () => {
  it('returns 0 when team has no files', async () => {
    const team = await createTeam({
      team: {
        uuid: '00000000-0000-0000-0000-000000000001',
      },
      users: [{ userId, role: 'OWNER' }],
    });

    const count = await fileCountForTeam(team, userId);
    expect(count.totalTeamFiles).toBe(0);
    expect(count.userPrivateFiles).toBe(0);
  });

  it('returns correct count when team has files', async () => {
    const team = await createTeam({
      team: {
        uuid: '00000000-0000-0000-0000-000000000002',
      },
      users: [{ userId, role: 'OWNER' }],
    });

    // Create 3 private files for the user
    await createFile({
      data: {
        uuid: '00000000-0000-0000-0000-000000000010',
        name: 'File 1',
        creatorUserId: userId,
        ownerTeamId: team.id,
        ownerUserId: userId,
      },
    });
    await createFile({
      data: {
        uuid: '00000000-0000-0000-0000-000000000011',
        name: 'File 2',
        creatorUserId: userId,
        ownerTeamId: team.id,
        ownerUserId: userId,
      },
    });
    await createFile({
      data: {
        uuid: '00000000-0000-0000-0000-000000000012',
        name: 'File 3',
        creatorUserId: userId,
        ownerTeamId: team.id,
        ownerUserId: userId,
      },
    });

    const count = await fileCountForTeam(team, userId);
    expect(count.totalTeamFiles).toBe(3);
    expect(count.userPrivateFiles).toBe(3);
  });

  it('does not count deleted files', async () => {
    const team = await createTeam({
      team: {
        uuid: '00000000-0000-0000-0000-000000000003',
      },
      users: [{ userId, role: 'OWNER' }],
    });

    // Create 2 active private files and 1 deleted private file
    await createFile({
      data: {
        uuid: '00000000-0000-0000-0000-000000000020',
        name: 'Active File 1',
        creatorUserId: userId,
        ownerTeamId: team.id,
        ownerUserId: userId,
        deleted: false,
      },
    });
    await createFile({
      data: {
        uuid: '00000000-0000-0000-0000-000000000021',
        name: 'Active File 2',
        creatorUserId: userId,
        ownerTeamId: team.id,
        ownerUserId: userId,
        deleted: false,
      },
    });
    await createFile({
      data: {
        uuid: '00000000-0000-0000-0000-000000000022',
        name: 'Deleted File',
        creatorUserId: userId,
        ownerTeamId: team.id,
        ownerUserId: userId,
        deleted: true,
        deletedDate: new Date(),
      },
    });

    const count = await fileCountForTeam(team, userId);
    expect(count.totalTeamFiles).toBe(2);
    expect(count.userPrivateFiles).toBe(2);
  });

  it('returns 0 when all files are deleted', async () => {
    const team = await createTeam({
      team: {
        uuid: '00000000-0000-0000-0000-000000000004',
      },
      users: [{ userId, role: 'OWNER' }],
    });

    // Create 3 deleted private files
    await createFile({
      data: {
        uuid: '00000000-0000-0000-0000-000000000030',
        name: 'Deleted File 1',
        creatorUserId: userId,
        ownerTeamId: team.id,
        ownerUserId: userId,
        deleted: true,
        deletedDate: new Date(),
      },
    });
    await createFile({
      data: {
        uuid: '00000000-0000-0000-0000-000000000031',
        name: 'Deleted File 2',
        creatorUserId: userId,
        ownerTeamId: team.id,
        ownerUserId: userId,
        deleted: true,
        deletedDate: new Date(),
      },
    });

    const count = await fileCountForTeam(team, userId);
    expect(count.totalTeamFiles).toBe(0);
    expect(count.userPrivateFiles).toBe(0);
  });

  it('only counts files for the specified team', async () => {
    const team1 = await createTeam({
      team: {
        uuid: '00000000-0000-0000-0000-000000000005',
      },
      users: [{ userId, role: 'OWNER' }],
    });

    const team2 = await createTeam({
      team: {
        uuid: '00000000-0000-0000-0000-000000000006',
      },
      users: [{ userId, role: 'OWNER' }],
    });

    // Create 2 private files for team1
    await createFile({
      data: {
        uuid: '00000000-0000-0000-0000-000000000040',
        name: 'Team 1 File 1',
        creatorUserId: userId,
        ownerTeamId: team1.id,
        ownerUserId: userId,
      },
    });
    await createFile({
      data: {
        uuid: '00000000-0000-0000-0000-000000000041',
        name: 'Team 1 File 2',
        creatorUserId: userId,
        ownerTeamId: team1.id,
        ownerUserId: userId,
      },
    });

    // Create 3 private files for team2
    await createFile({
      data: {
        uuid: '00000000-0000-0000-0000-000000000050',
        name: 'Team 2 File 1',
        creatorUserId: userId,
        ownerTeamId: team2.id,
        ownerUserId: userId,
      },
    });
    await createFile({
      data: {
        uuid: '00000000-0000-0000-0000-000000000051',
        name: 'Team 2 File 2',
        creatorUserId: userId,
        ownerTeamId: team2.id,
        ownerUserId: userId,
      },
    });
    await createFile({
      data: {
        uuid: '00000000-0000-0000-0000-000000000052',
        name: 'Team 2 File 3',
        creatorUserId: userId,
        ownerTeamId: team2.id,
        ownerUserId: userId,
      },
    });

    const count1 = await fileCountForTeam(team1, userId);
    const count2 = await fileCountForTeam(team2, userId);

    expect(count1.totalTeamFiles).toBe(2);
    expect(count1.userPrivateFiles).toBe(2);
    expect(count2.totalTeamFiles).toBe(3);
    expect(count2.userPrivateFiles).toBe(3);
  });

  it('distinguishes between total team files and user private files', async () => {
    const user2Id = (
      await createUser({
        auth0Id: 'testUser2',
      })
    ).id;

    const team = await createTeam({
      team: {
        uuid: '00000000-0000-0000-0000-000000000007',
      },
      users: [
        { userId, role: 'OWNER' },
        { userId: user2Id, role: 'EDITOR' },
      ],
    });

    // Create 2 private files by user1
    await createFile({
      data: {
        uuid: '00000000-0000-0000-0000-000000000060',
        name: 'User 1 File 1',
        creatorUserId: userId,
        ownerTeamId: team.id,
        ownerUserId: userId,
      },
    });
    await createFile({
      data: {
        uuid: '00000000-0000-0000-0000-000000000061',
        name: 'User 1 File 2',
        creatorUserId: userId,
        ownerTeamId: team.id,
        ownerUserId: userId,
      },
    });

    // Create 3 private files by user2
    await createFile({
      data: {
        uuid: '00000000-0000-0000-0000-000000000062',
        name: 'User 2 File 1',
        creatorUserId: user2Id,
        ownerTeamId: team.id,
        ownerUserId: user2Id,
      },
    });
    await createFile({
      data: {
        uuid: '00000000-0000-0000-0000-000000000063',
        name: 'User 2 File 2',
        creatorUserId: user2Id,
        ownerTeamId: team.id,
        ownerUserId: user2Id,
      },
    });
    await createFile({
      data: {
        uuid: '00000000-0000-0000-0000-000000000064',
        name: 'User 2 File 3',
        creatorUserId: user2Id,
        ownerTeamId: team.id,
        ownerUserId: user2Id,
      },
    });

    const count1 = await fileCountForTeam(team, userId);
    const count2 = await fileCountForTeam(team, user2Id);

    // User 1 perspective: 5 total team files, 2 private files owned by user1
    expect(count1.totalTeamFiles).toBe(5);
    expect(count1.userPrivateFiles).toBe(2);

    // User 2 perspective: 5 total team files, 3 private files owned by user2
    expect(count2.totalTeamFiles).toBe(5);
    expect(count2.userPrivateFiles).toBe(3);
  });
});

describe('teamHasReachedFileLimit', () => {
  it('returns false for paid teams', async () => {
    let team: DecryptedTeam | Team | null = await createTeam({
      team: {
        uuid: '00000000-0000-0000-0000-000000000100',
      },
      users: [{ userId, role: 'OWNER' }],
    });

    // Upgrade to paid plan
    await upgradeTeamToPro(team.id);

    // Refetch team to get updated subscription status
    team = await dbClient.team.findUnique({
      where: { id: team.id },
    });

    if (!team) {
      throw new Error('Team not found after upgrade');
    }

    // Create files beyond the free limit
    for (let i = 0; i < 5; i++) {
      await createFile({
        data: {
          uuid: `00000000-0000-0000-0100-0000000000${i.toString().padStart(2, '0')}`,
          name: `File ${i}`,
          creatorUserId: userId,
          ownerTeamId: team.id,
          ownerUserId: userId,
        },
      });
    }

    // Should not hit limit with paid plan
    expect(await hasReachedFileLimit(team, userId, true)).toBe(false);
    expect(await hasReachedFileLimit(team, userId, false)).toBe(false);
    expect(await hasReachedFileLimit(team, userId)).toBe(false);
  });

  it('checks private file limit when isPrivate=true', async () => {
    const team = await createTeam({
      team: {
        uuid: '00000000-0000-0000-0000-000000000101',
      },
      users: [{ userId, role: 'OWNER' }],
    });

    // Create 1 private file (per-user limit is 1)
    await createFile({
      data: {
        uuid: '00000000-0000-0000-0101-000000000001',
        name: 'Private File 1',
        creatorUserId: userId,
        ownerTeamId: team.id,
        ownerUserId: userId,
      },
    });

    // Should hit private file limit
    expect(await hasReachedFileLimit(team, userId, true)).toBe(true);

    // Should NOT hit team file limit (only 1 file out of 3)
    expect(await hasReachedFileLimit(team, userId, false)).toBe(false);

    // Without parameter, defaults to team limit check (false since only 1 out of 3)
    expect(await hasReachedFileLimit(team, userId)).toBe(false);
  });

  it('checks team file limit when isPrivate=false', async () => {
    const user2Id = (
      await createUser({
        auth0Id: 'testUser2',
      })
    ).id;

    const team = await createTeam({
      team: {
        uuid: '00000000-0000-0000-0000-000000000102',
      },
      users: [
        { userId, role: 'OWNER' },
        { userId: user2Id, role: 'EDITOR' },
      ],
    });

    // Create 3 team files total (team limit is 3)
    // User 1 creates 1, user 2 creates 2
    await createFile({
      data: {
        uuid: '00000000-0000-0000-0102-000000000001',
        name: 'File 1',
        creatorUserId: userId,
        ownerTeamId: team.id,
        ownerUserId: userId,
      },
    });

    await createFile({
      data: {
        uuid: '00000000-0000-0000-0102-000000000002',
        name: 'File 2',
        creatorUserId: user2Id,
        ownerTeamId: team.id,
        ownerUserId: user2Id,
      },
    });

    await createFile({
      data: {
        uuid: '00000000-0000-0000-0102-000000000003',
        name: 'File 3',
        creatorUserId: user2Id,
        ownerTeamId: team.id,
        ownerUserId: user2Id,
      },
    });

    // User 1 has reached their private limit (1 file)
    expect(await hasReachedFileLimit(team, userId, true)).toBe(true);

    // Team has reached the team file limit (3 files)
    expect(await hasReachedFileLimit(team, userId, false)).toBe(true);

    // Without parameter, defaults to team limit check (true since 3 out of 3)
    expect(await hasReachedFileLimit(team, userId)).toBe(true);

    // User 2 has 2 private files, so they HAVE exceeded the limit of 1
    expect(await hasReachedFileLimit(team, user2Id, true)).toBe(true);
  });

  it('allows team file creation when only private limit is reached', async () => {
    const user2Id = (
      await createUser({
        auth0Id: 'testUser3',
      })
    ).id;

    const team = await createTeam({
      team: {
        uuid: '00000000-0000-0000-0000-000000000103',
      },
      users: [
        { userId, role: 'OWNER' },
        { userId: user2Id, role: 'EDITOR' },
      ],
    });

    // User 1 creates 1 private file (reaches their private limit of 1)
    await createFile({
      data: {
        uuid: '00000000-0000-0000-0103-000000000001',
        name: 'Private File 1',
        creatorUserId: userId,
        ownerTeamId: team.id,
        ownerUserId: userId,
      },
    });

    // User 1 has reached private limit
    expect(await hasReachedFileLimit(team, userId, true)).toBe(true);

    // But team has NOT reached team file limit (1 out of 3)
    expect(await hasReachedFileLimit(team, userId, false)).toBe(false);
  });

  it('allows private file creation when only team limit is reached', async () => {
    const user2Id = (
      await createUser({
        auth0Id: 'testUser4',
      })
    ).id;

    const user3Id = (
      await createUser({
        auth0Id: 'testUser5',
      })
    ).id;

    const team = await createTeam({
      team: {
        uuid: '00000000-0000-0000-0000-000000000104',
      },
      users: [
        { userId, role: 'OWNER' },
        { userId: user2Id, role: 'EDITOR' },
        { userId: user3Id, role: 'EDITOR' },
      ],
    });

    // Create 3 files from different users (team limit is 3)
    await createFile({
      data: {
        uuid: '00000000-0000-0000-0104-000000000001',
        name: 'File 1',
        creatorUserId: userId,
        ownerTeamId: team.id,
        ownerUserId: userId,
      },
    });

    await createFile({
      data: {
        uuid: '00000000-0000-0000-0104-000000000002',
        name: 'File 2',
        creatorUserId: user2Id,
        ownerTeamId: team.id,
        ownerUserId: user2Id,
      },
    });

    await createFile({
      data: {
        uuid: '00000000-0000-0000-0104-000000000003',
        name: 'File 3',
        creatorUserId: user3Id,
        ownerTeamId: team.id,
        ownerUserId: user3Id,
      },
    });

    // Team has reached team file limit (3 files)
    expect(await hasReachedFileLimit(team, userId, false)).toBe(true);

    // But each user has NOT reached their private limit (each has only 1 file, limit is 1)
    // Actually they HAVE reached it, since they each have 1 file and limit is 1
    expect(await hasReachedFileLimit(team, userId, true)).toBe(true);
    expect(await hasReachedFileLimit(team, user2Id, true)).toBe(true);
    expect(await hasReachedFileLimit(team, user3Id, true)).toBe(true);
  });

  it('returns false when neither limit is reached', async () => {
    const team = await createTeam({
      team: {
        uuid: '00000000-0000-0000-0000-000000000105',
      },
      users: [{ userId, role: 'OWNER' }],
    });

    // No files created yet
    expect(await hasReachedFileLimit(team, userId, true)).toBe(false);
    expect(await hasReachedFileLimit(team, userId, false)).toBe(false);
    expect(await hasReachedFileLimit(team, userId)).toBe(false);
  });
});
