import { clearDb, createFile, createTeam, createUser } from '../tests/testDataGenerator';
import { fileCountForTeam } from './billing';

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
